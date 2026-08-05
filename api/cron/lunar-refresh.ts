/**
 * 农历年度刷新 Cron 任务
 * 每年 12月31日 UTC 17:00 执行（北京时间次年1月1日01:00）
 * 查询所有 lunar=true 且 repeat_yearly=true 的提醒
 * 将农历日期换算为下一年的公历日期，更新 reminders 表的 date 字段
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCronSecret, AuthError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

// ============ 辅助函数 ============

/**
 * 获取当前年份标识（用于幂等性检查）
 */
function getCurrentYearId(): string {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return `${beijingTime.getFullYear()}`;
}

/**
 * 检查当年是否已执行
 */
async function hasExecutedThisYear(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobName: string,
  executionYear: string
): Promise<boolean> {
  const { data, error: queryError } = await supabase
    .from('cron_executions')
    .select('id')
    .eq('job_name', jobName)
    .eq('execution_date', executionYear)
    .eq('status', 'completed')
    .limit(1);

  if (queryError) {
    console.error('[LunarRefresh] 查询 cron_executions 失败:', queryError.message);
    return false;
  }

  return data && data.length > 0;
}

/**
 * 记录执行状态
 */
async function recordExecution(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobName: string,
  executionYear: string,
  result: string
): Promise<void> {
  try {
    await supabase.from('cron_executions').insert({
      job_name: jobName,
      execution_date: executionYear,
      status: 'completed',
      result,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[LunarRefresh] 记录执行状态失败:`, e);
  }
}

/**
 * 将农历日期转换为下一年的公历日期
 * 使用 lunar-javascript 进行换算
 * @param lunarMonth 农历月份（1-12）
 * @param lunarDay 农历日（1-30）
 * @param nextYear 目标公历年
 * @returns 公历日期 Date 对象
 */
async function lunarToSolarForYear(
  lunarMonth: number,
  lunarDay: number,
  nextYear: number
): Promise<Date | null> {
  try {
    // 动态导入 lunar-javascript
    const { Lunar, Solar } = await import('lunar-javascript');

    // 创建农历日期对象
    const lunar = Lunar.fromYmd(nextYear, lunarMonth, lunarDay);

    // 转换为公历
    const solar = lunar.getSolar();

    return new Date(
      solar.getYear(),
      solar.getMonth() - 1, // JavaScript 月份从 0 开始
      solar.getDay()
    );
  } catch (e) {
    console.error(
      `[LunarRefresh] 农历 ${nextYear}-${lunarMonth}-${lunarDay} 转换失败:`,
      e
    );
    return null;
  }
}

/**
 * 从公历日期中提取农历月日信息
 * 因为 reminders.date 存储的是原始农历日期换算后的公历日期
 * 需要反向推算出农历月日
 * @param calendarDate 存储的公历日期
 * @returns 包含农历月份和日期，失败返回 null
 */
async function extractLunarInfo(
  calendarDate: Date
): Promise<{ lunarMonth: number; lunarDay: number } | null> {
  try {
    const { Lunar, Solar } = await import('lunar-javascript');

    // 将原始公历日期反向转换为农历
    const solar = Solar.fromDate(calendarDate);
    const lunar = solar.getLunar();

    return {
      lunarMonth: lunar.getMonth(),
      lunarDay: lunar.getDay(),
    };
  } catch (e) {
    console.error('[LunarRefresh] 提取农历信息失败:', e);
    return null;
  }
}

// ============ 主处理器 ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. 验证 Cron 密钥
    verifyCronSecret(req);

    // 2. 幂等性检查
    const supabase = getSupabaseAdmin();
    const executionYear = getCurrentYearId();
    const jobName = 'lunar-refresh';

    const alreadyExecuted = await hasExecutedThisYear(supabase, jobName, executionYear);
    if (alreadyExecuted) {
      console.log(`[LunarRefresh] ${executionYear} 年已执行，跳过`);
      return success(res, { message: `任务已于 ${executionYear} 年执行，跳过本次` });
    }

    // 3. 查询所有 lunar=true 且 repeat_yearly=true 的提醒
    const { data: reminders, error: queryError } = await supabase
      .from('reminders')
      .select('*')
      .eq('lunar', true)
      .eq('repeat_yearly', true);

    if (queryError) {
      console.error('[LunarRefresh] 查询提醒失败:', queryError.message);
      return error(res, 500, '查询提醒失败');
    }

    if (!reminders || reminders.length === 0) {
      console.log('[LunarRefresh] 没有需要刷新的农历年度提醒');
      await recordExecution(supabase, jobName, executionYear, '没有需要刷新的提醒');
      return success(res, { message: '没有需要刷新的农历年度提醒', updatedCount: 0 });
    }

    // 4. 计算目标年份（当年 + 1）
    const oldYear = parseInt(executionYear) - 1;
    const targetYear = parseInt(executionYear);

    // 5. 按条处理
    let updatedCount = 0;
    const results: {
      reminderId: number;
      title: string;
      oldDate: string;
      newDate: string | null;
      success: boolean;
    }[] = [];

    for (const reminder of reminders) {
      try {
        // 从存储的公历日期反向提取农历月日
        const calendarDate = new Date(reminder.date);

        if (isNaN(calendarDate.getTime())) {
          results.push({
            reminderId: reminder.id,
            title: reminder.title || '未命名',
            oldDate: reminder.date,
            newDate: null,
            success: false,
          });
          continue;
        }

        const lunarInfo = await extractLunarInfo(calendarDate);

        if (!lunarInfo) {
          results.push({
            reminderId: reminder.id,
            title: reminder.title || '未命名',
            oldDate: reminder.date,
            newDate: null,
            success: false,
          });
          continue;
        }

        // 将农历日期转换为目标年的公历日期
        const solarDate = await lunarToSolarForYear(
          lunarInfo.lunarMonth,
          lunarInfo.lunarDay,
          targetYear
        );

        if (!solarDate) {
          results.push({
            reminderId: reminder.id,
            title: reminder.title || '未命名',
            oldDate: reminder.date,
            newDate: null,
            success: false,
          });
          continue;
        }

        // 更新提醒的 date 字段
        const newDateStr = solarDate.toISOString().substring(0, 10);
        const { error: updateError } = await supabase
          .from('reminders')
          .update({
            date: newDateStr,
            notified: false, // 重置通知状态
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        if (updateError) {
          console.error(
            `[LunarRefresh] 更新提醒 #${reminder.id} 失败:`,
            updateError.message
          );
          results.push({
            reminderId: reminder.id,
            title: reminder.title || '未命名',
            oldDate: reminder.date,
            newDate: null,
            success: false,
          });
          continue;
        }

        updatedCount++;
        results.push({
          reminderId: reminder.id,
          title: reminder.title || '未命名',
          oldDate: reminder.date,
          newDate: newDateStr,
          success: true,
        });
      } catch (e) {
        console.error(`[LunarRefresh] 处理提醒 #${reminder.id} 失败:`, e);
        results.push({
          reminderId: reminder.id,
          title: reminder.title || '未命名',
          oldDate: reminder.date,
          newDate: null,
          success: false,
        });
      }
    }

    // 6. 记录执行结果
    const resultMsg = `检查了 ${reminders.length} 个农历年度提醒，更新了 ${updatedCount} 个`;
    await recordExecution(supabase, jobName, executionYear, resultMsg);

    console.log(`[LunarRefresh] ${resultMsg}`);

    // 7. 返回结果
    return success(res, {
      executionYear,
      totalCount: reminders.length,
      updatedCount,
      results,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[LunarRefresh] 执行失败:', e);
    return error(res, 500, 'Cron 任务执行失败');
  }
}
