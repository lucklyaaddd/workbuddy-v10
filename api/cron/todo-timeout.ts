/**
 * 待办超时标记 Cron 任务
 * 每日北京时间 00:30 执行（UTC 16:30）
 * 将当天所有 status=0 的待办标记为 status=2（超时）
 * 状态码说明：0=未完成 1=已完成 2=超时
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCronSecret, AuthError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

// ============ 辅助函数 ============

/**
 * 获取当天北京时间 00:00 作为日期边界（UTC+8）
 * 北京时间 00:00 = UTC 16:00（前一天）
 */
function getBeijingDate(): string {
  const now = new Date();
  // 转换为北京时间（UTC+8）
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  // 获取北京时间日期字符串 YYYY-MM-DD
  return beijingTime.toISOString().substring(0, 10);
}

/**
 * 检查是否已在当天执行过
 * 通过查询 cron_executions 表实现幂等
 * @param supabase Supabase 管理员客户端
 * @param jobName 任务标识
 * @param executionDate 执行日期
 * @returns 是否已执行
 */
async function hasExecutedToday(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobName: string,
  executionDate: string
): Promise<boolean> {
  const { data, error: queryError } = await supabase
    .from('cron_executions')
    .select('id')
    .eq('job_name', jobName)
    .eq('execution_date', executionDate)
    .eq('status', 'completed')
    .limit(1);

  if (queryError) {
    console.error('[TodoTimeout] 查询 cron_executions 失败:', queryError.message);
    // 查询失败不阻止执行（降级策略）
    return false;
  }

  return data && data.length > 0;
}

/**
 * 记录 Cron 任务执行状态
 * @param supabase Supabase 管理员客户端
 * @param jobName 任务标识
 * @param executionDate 执行日期
 * @param result 执行结果摘要
 */
async function recordExecution(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobName: string,
  executionDate: string,
  result: string
): Promise<void> {
  try {
    await supabase.from('cron_executions').insert({
      job_name: jobName,
      execution_date: executionDate,
      status: 'completed',
      result,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[TodoTimeout] 记录执行状态失败:`, e);
  }
}

// ============ 主处理器 ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. 验证 Cron 密钥
    verifyCronSecret(req);

    // 2. 获取 Supabase 管理员客户端
    const supabase = getSupabaseAdmin();

    // 3. 获取北京时间日期
    const beijingDate = getBeijingDate();
    const jobName = 'todo-timeout';

    // 4. 幂等性检查：是否已执行
    const alreadyExecuted = await hasExecutedToday(supabase, jobName, beijingDate);
    if (alreadyExecuted) {
      console.log(`[TodoTimeout] ${beijingDate} 已执行，跳过`);
      return success(res, { message: `任务已于 ${beijingDate} 执行，跳过本次` });
    }

    // 5. 计算当天北京时间 00:00 的 UTC 时间
    // 北京时间 YYYY-MM-DD 00:00 = UTC (YYYY-MM-DD - 8h)
    const dayStart = new Date(`${beijingDate}T00:00:00+08:00`);
    const dayEnd = new Date(`${beijingDate}T23:59:59.999+08:00`);

    // 6. 将当天 status=0（未完成）的待办标记为 status=2（超时）
    const { data: updatedTodos, error: updateError } = await supabase
      .from('todos')
      .update({
        status: 2, // 超时
        updated_at: new Date().toISOString(),
      })
      .eq('status', 0) // 未完成
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString())
      .select('id');

    if (updateError) {
      console.error('[TodoTimeout] 更新待办状态失败:', updateError.message);
      return error(res, 500, '更新待办状态失败');
    }

    const updatedCount = updatedTodos?.length || 0;

    // 7. 记录执行结果
    const resultMsg = `已将 ${updatedCount} 个待办标记为超时（日期：${beijingDate}）`;
    await recordExecution(supabase, jobName, beijingDate, resultMsg);

    console.log(`[TodoTimeout] ${resultMsg}`);

    // 8. 返回结果
    return success(res, {
      executionDate: beijingDate,
      updatedCount,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[TodoTimeout] 执行失败:', e);
    return error(res, 500, 'Cron 任务执行失败');
  }
}
