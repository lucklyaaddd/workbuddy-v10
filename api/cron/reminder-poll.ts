/**
 * 智能提醒轮询 Cron 任务
 * 每小时整点执行
 * 查询所有 reminders 表中即将到期的提醒
 * 支持农历提醒、周期提醒的自动迭代计算下一次触发日期
 * 向符合条件的提醒所有者发送 Bark 推送通知
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCronSecret, AuthError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { decrypt } from '../../src/lib/crypto';

// ============ 辅助函数 ============

/**
 * 获取当前小时的时间戳标识
 */
function getCurrentHourId(): string {
  const now = new Date();
  return `${now.toISOString().substring(0, 13)}:00`;
}

/**
 * 检查是否已在当前小时内执行过
 */
async function hasExecutedThisHour(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobName: string,
  executionHour: string
): Promise<boolean> {
  const { data, error: queryError } = await supabase
    .from('cron_executions')
    .select('id')
    .eq('job_name', jobName)
    .eq('execution_date', executionHour)
    .eq('status', 'completed')
    .limit(1);

  if (queryError) {
    console.error('[ReminderPoll] 查询 cron_executions 失败:', queryError.message);
    return false;
  }

  return data && data.length > 0;
}

/**
 * 记录 Cron 任务执行状态
 */
async function recordExecution(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobName: string,
  executionHour: string,
  result: string
): Promise<void> {
  try {
    await supabase.from('cron_executions').insert({
      job_name: jobName,
      execution_date: executionHour,
      status: 'completed',
      result,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[ReminderPoll] 记录执行状态失败:`, e);
  }
}

/**
 * 计算农历日期对应的公历日期
 * 使用 lunar-javascript 库进行换算
 * @param year 农历年份
 * @param month 农历月份
 * @param day 农历日
 * @returns 公历 Date 对象
 */
async function lunarToSolar(
  year: number,
  month: number,
  day: number
): Promise<Date | null> {
  try {
    // 动态导入 lunar-javascript（仅服务端可用）
    const { Lunar, Solar } = await import('lunar-javascript');
    const lunar = Lunar.fromYmd(year, month, day);
    const solar = lunar.getSolar();
    return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
  } catch (e) {
    console.error('[ReminderPoll] 农历转换失败:', e);
    return null;
  }
}

/**
 * 计算周期提醒的下一次触发日期
 * @param reminder 提醒记录
 * @returns 下一次触发时间（Date 对象），null 表示无需再触发
 */
function calculateNextRepeatDate(reminder: Record<string, any>): Date | null {
  const now = new Date();
  const originalDate = new Date(reminder.date);

  if (isNaN(originalDate.getTime())) return null;

  // 如果提醒已经过期且不是周期提醒，无需处理
  if (originalDate < now && !reminder.repeat_type) return null;

  const repeatType = reminder.repeat_type; // 'daily' | 'weekly' | 'monthly' | 'yearly'
  let currentDate = new Date(originalDate);

  // 迭代计算下一次触发日期，直到超过当前时间
  // 最多迭代 365 次（防止死循环）
  let iterations = 0;
  const maxIterations = 365;

  while (currentDate < now && iterations < maxIterations) {
    switch (repeatType) {
      case 'daily':
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        currentDate = new Date(currentDate);
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'yearly':
        currentDate = new Date(currentDate);
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      default:
        return null; // 非周期提醒
    }
    iterations++;
  }

  if (iterations >= maxIterations) return null;

  // 如果当前日期 > 原始日期（意味着我们找到了下一个触发点）
  if (currentDate > originalDate) {
    return currentDate;
  }

  return null;
}

/**
 * 判断提醒是否需要现在提醒
 * 考虑提前提醒天数（advance_days）
 * @param reminder 提醒记录
 * @param targetDate 目标日期（可能经过农历转换或周期迭代）
 * @returns 需要在 1 小时内提醒
 */
function shouldRemindNow(reminder: Record<string, any>, targetDate: Date): boolean {
  const now = new Date();
  const advanceDays = reminder.advance_days || 0;

  // 计算提醒应该触发的时间点
  const remindTime = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate() - advanceDays,
    8, // 北京时间 08:00 开始提醒
    0,
    0,
    0
  );

  // 判断提醒时间是否在 1 小时内
  const diff = remindTime.getTime() - now.getTime();
  return diff >= 0 && diff <= 60 * 60 * 1000; // 0 到 1 小时内
}

/**
 * 发送提醒推送
 * @param reminder 提醒记录
 * @param subscription Bark 订阅
 * @param titlePrefix 标题前缀（根据提醒类型区分）
 */
async function sendReminderPush(
  reminder: Record<string, any>,
  subscription: Record<string, any>,
  titlePrefix: string
): Promise<{ success: boolean; message: string }> {
  try {
    const decryptedEndpoint = decrypt(subscription.endpoint);

    const title = reminder.title || '提醒';
    const notes = reminder.notes || '';

    // 计算还有多少天
    const targetDate = new Date(reminder.date);
    const daysUntil = Math.ceil(
      (targetDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    const bodyText = notes
      ? `${notes.substring(0, 200)}\n距今还有 ${daysUntil > 0 ? daysUntil : 0} 天`
      : `距今还有 ${daysUntil > 0 ? daysUntil : 0} 天`;

    const response = await fetch(decryptedEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${titlePrefix} ${title}`,
        body: bodyText,
        group: 'WorkBuddy',
        level: 'timeSensitive',
        sound: 'notification',
      }),
    });

    if (response.status === 200) {
      return { success: true, message: '推送成功' };
    }

    return { success: false, message: `推送失败: HTTP ${response.status}` };
  } catch (e) {
    return { success: false, message: `推送失败: ${(e as Error).message}` };
  }
}

// ============ 主处理器 ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. 验证 Cron 密钥
    verifyCronSecret(req);

    // 2. 幂等性检查
    const supabase = getSupabaseAdmin();
    const executionHour = getCurrentHourId();
    const jobName = 'reminder-poll';

    const alreadyExecuted = await hasExecutedThisHour(supabase, jobName, executionHour);
    if (alreadyExecuted) {
      console.log(`[ReminderPoll] ${executionHour} 已执行，跳过`);
      return success(res, { message: `任务已于 ${executionHour} 执行，跳过本次` });
    }

    // 3. 查询所有未处理的提醒（notified=false 或 notified 为 null）
    const { data: reminders, error: queryError } = await supabase
      .from('reminders')
      .select('*')
      .or('notified.is.null,notified.eq.false');

    if (queryError) {
      console.error('[ReminderPoll] 查询提醒失败:', queryError.message);
      return error(res, 500, '查询提醒失败');
    }

    if (!reminders || reminders.length === 0) {
      console.log('[ReminderPoll] 没有待处理的提醒');
      await recordExecution(supabase, jobName, executionHour, '没有待处理的提醒');
      return success(res, { message: '没有待处理的提醒', notifyCount: 0 });
    }

    // 4. 处理每个提醒
    let notifyCount = 0;
    const results: {
      reminderId: number;
      title: string;
      type: string;
      success: boolean;
      message: string;
    }[] = [];

    for (const reminder of reminders) {
      try {
        let targetDate: Date | null = new Date(reminder.date);

        // 检查日期是否有效
        if (isNaN(targetDate.getTime())) {
          continue; // 跳过无效日期
        }

        // 处理农历提醒：将农历日期转换为公历日期
        if (reminder.lunar) {
          const lunarDate = new Date(reminder.date);
          const solarDate = await lunarToSolar(
            lunarDate.getFullYear(),
            lunarDate.getMonth() + 1,
            lunarDate.getDate()
          );
          if (solarDate) {
            targetDate = solarDate;
          }
        }

        // 处理周期提醒：自动迭代计算下一次触发日期
        if (reminder.repeat_yearly || reminder.repeat_type) {
          const nextDate = calculateNextRepeatDate(reminder);
          if (nextDate) {
            targetDate = nextDate;
          }
        }

        if (!targetDate) continue;

        // 判断是否需要在当前小时内提醒
        if (!shouldRemindNow(reminder, targetDate)) continue;

        // 确定标题前缀
        let titlePrefix = '🔔 日程提醒';
        if (reminder.type === 'birthday') {
          titlePrefix = '🎂 生日提醒';
        }

        // 获取用户的 Bark 订阅
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', reminder.user_id)
          .eq('type', 'bark');

        if (!subscriptions || subscriptions.length === 0) {
          results.push({
            reminderId: reminder.id,
            title: reminder.title || '未命名提醒',
            type: reminder.type || 'custom',
            success: false,
            message: '用户未配置 Bark 推送',
          });
          continue;
        }

        // 发送推送（向第一个设备发送）
        const pushResult = await sendReminderPush(
          reminder,
          subscriptions[0],
          titlePrefix
        );

        results.push({
          reminderId: reminder.id,
          title: reminder.title || '未命名提醒',
          type: reminder.type || 'custom',
          success: pushResult.success,
          message: pushResult.message,
        });

        // 标记为已通知
        if (pushResult.success) {
          await supabase
            .from('reminders')
            .update({
              notified: true,
              last_notified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', reminder.id);

          notifyCount++;
        }
      } catch (e) {
        console.error(`[ReminderPoll] 处理提醒 #${reminder.id} 失败:`, e);
        results.push({
          reminderId: reminder.id,
          title: reminder.title || '未命名提醒',
          type: reminder.type || 'custom',
          success: false,
          message: `处理失败: ${(e as Error).message}`,
        });
      }
    }

    // 5. 记录执行结果
    const resultMsg = `检查了 ${reminders.length} 个提醒，推送了 ${notifyCount} 个`;
    await recordExecution(supabase, jobName, executionHour, resultMsg);

    console.log(`[ReminderPoll] ${resultMsg}`);

    // 6. 返回结果
    return success(res, {
      executionHour,
      checkedCount: reminders.length,
      notifyCount,
      results,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[ReminderPoll] 执行失败:', e);
    return error(res, 500, 'Cron 任务执行失败');
  }
}
