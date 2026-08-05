/**
 * 月度备份提醒 Cron 任务
 * 每月 1 日 UTC 00:00 执行（北京时间 08:00）
 * 向所有用户推送备份提醒，引导用户导出数据备份
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCronSecret, AuthError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { decrypt } from '../../src/lib/crypto';

// ============ 辅助函数 ============

/**
 * 获取当前月份标识（YYYY-MM）
 */
function getCurrentMonth(): string {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return `${beijingTime.getFullYear()}-${String(beijingTime.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 检查当月是否已执行
 */
async function hasExecutedThisMonth(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobName: string,
  executionMonth: string
): Promise<boolean> {
  const { data, error: queryError } = await supabase
    .from('cron_executions')
    .select('id')
    .eq('job_name', jobName)
    .eq('execution_date', executionMonth)
    .eq('status', 'completed')
    .limit(1);

  if (queryError) {
    console.error('[BackupRemind] 查询 cron_executions 失败:', queryError.message);
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
  executionMonth: string,
  result: string
): Promise<void> {
  try {
    await supabase.from('cron_executions').insert({
      job_name: jobName,
      execution_date: executionMonth,
      status: 'completed',
      result,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[BackupRemind] 记录执行状态失败:`, e);
  }
}

/**
 * 获取所有用户的 Bark 订阅
 * 限制每次最多处理 500 个用户（防止超时）
 */
async function getAllUserSubscriptions(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<Record<string, { userId: string; subscriptions: Record<string, any>[] }>> {
  const { data: subscriptions, error: queryError } = await supabase
    .from('push_subscriptions')
    .select('user_id, id, endpoint, device_name')
    .eq('type', 'bark')
    .limit(500);

  if (queryError) {
    console.error('[BackupRemind] 查询所有订阅失败:', queryError.message);
    return {};
  }

  // 按用户分组
  const userSubMap: Record<string, { userId: string; subscriptions: Record<string, any>[] }> = {};

  for (const sub of subscriptions || []) {
    if (!userSubMap[sub.user_id]) {
      userSubMap[sub.user_id] = { userId: sub.user_id, subscriptions: [] };
    }
    userSubMap[sub.user_id].subscriptions.push(sub);
  }

  return userSubMap;
}

/**
 * 发送备份提醒推送
 * @param subscription Bark 订阅记录
 * @returns 推送结果
 */
async function sendBackupReminder(
  subscription: Record<string, any>
): Promise<{ success: boolean; message: string }> {
  try {
    const decryptedEndpoint = decrypt(subscription.endpoint);

    const response = await fetch(decryptedEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '📢 系统通知',
        body: '📦 月度备份提醒：建议您导出 WorkBuddy 数据作为备份，防止数据丢失。请在设置页面选择「数据导出」并下载备份文件。',
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
    const executionMonth = getCurrentMonth();
    const jobName = 'backup-remind';

    const alreadyExecuted = await hasExecutedThisMonth(supabase, jobName, executionMonth);
    if (alreadyExecuted) {
      console.log(`[BackupRemind] ${executionMonth} 月已执行，跳过`);
      return success(res, { message: `任务已于 ${executionMonth} 月执行，跳过本次` });
    }

    // 3. 获取所有用户的 Bark 订阅
    const userSubMap = await getAllUserSubscriptions(supabase);

    if (Object.keys(userSubMap).length === 0) {
      console.log('[BackupRemind] 没有需要推送的用户');
      await recordExecution(supabase, jobName, executionMonth, '没有配置 Bark 推送的用户');
      return success(res, { message: '没有需要推送的用户', userCount: 0, pushCount: 0 });
    }

    // 4. 向每个用户发送备份提醒
    let successCount = 0;
    let failCount = 0;

    for (const [, userData] of Object.entries(userSubMap)) {
      // 只向每个用户的第一个设备发送（避免重复推送）
      if (userData.subscriptions.length > 0) {
        const result = await sendBackupReminder(userData.subscriptions[0]);

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    // 5. 记录执行结果
    const resultMsg = `向 ${Object.keys(userSubMap).length} 个用户发送备份提醒：成功 ${successCount}，失败 ${failCount}`;
    await recordExecution(supabase, jobName, executionMonth, resultMsg);

    console.log(`[BackupRemind] ${resultMsg}`);

    // 6. 返回结果
    return success(res, {
      executionMonth,
      userCount: Object.keys(userSubMap).length,
      successCount,
      failCount,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[BackupRemind] 执行失败:', e);
    return error(res, 500, 'Cron 任务执行失败');
  }
}
