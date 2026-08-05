/**
 * 待办定时推送 Cron 任务
 * 每小时整点执行
 * 查询所有 is_reminded=false 且 status=0 的待办
 * 检查当前时间是否到达 remind_offset 计算的提醒时间
 * 向触达的待办所有者发送 Bark 推送通知
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCronSecret, AuthError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { decrypt } from '../../src/lib/crypto';

// ============ 辅助函数 ============

/**
 * 获取当前小时的时间戳（整点）
 * 用于幂等性检查：同一小时内只执行一次
 */
function getCurrentHourId(): string {
  const now = new Date();
  return `${now.toISOString().substring(0, 13)}:00`;
}

/**
 * 检查是否已在当前小时内执行过
 * @param supabase Supabase 管理员客户端
 * @param jobName 任务标识
 * @param executionHour 执行小时标识
 * @returns 是否已执行
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
    console.error('[TodoRemind] 查询 cron_executions 失败:', queryError.message);
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
    console.error(`[TodoRemind] 记录执行状态失败:`, e);
  }
}

/**
 * 计算提醒时间
 * 根据 remind_offset（分钟）从待办截止时间反推提醒时间
 * @param todo 待办记录
 * @returns 提醒时间（Date 对象），无法计算则返回 null
 */
function calculateRemindTime(todo: Record<string, any>): Date | null {
  // remind_offset 是提前提醒的分钟数（如 30 表示提前 30 分钟提醒）
  const remindOffset = todo.remind_offset || 0;

  // 如果有 deadline 字段，使用 deadline 计算
  if (todo.deadline) {
    const deadlineDate = new Date(todo.deadline);
    if (isNaN(deadlineDate.getTime())) return null;
    return new Date(deadlineDate.getTime() - remindOffset * 60 * 1000);
  }

  // 如果没有 deadline，使用 created_at + 默认过期时间计算
  return null;
}

/**
 * 发送单个待办的推送通知
 * @param todo 待办记录
 * @param subscription Bark 订阅记录
 */
async function sendTodoReminder(
  todo: Record<string, any>,
  subscription: Record<string, any>
): Promise<{ success: boolean; message: string }> {
  try {
    const decryptedEndpoint = decrypt(subscription.endpoint);

    // 构建推送内容
    const todoTitle = todo.title || '待办事项';
    const body = todo.description
      ? `内容：${todo.description.substring(0, 100)}`
      : '你有一个待办事项需要处理';

    const response = await fetch(decryptedEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `⏰ 待办提醒`,
        body: `${todoTitle}\n${body}`,
        group: 'WorkBuddy',
        level: 'timeSensitive',
        sound: 'notification',
        category: 'todo_reminder',
      }),
    });

    if (response.status === 200) {
      return { success: true, message: '推送成功' };
    }

    const data = await response.json().catch(() => ({}));
    return {
      success: false,
      message: `推送失败: ${(data as any).message || `HTTP ${response.status}`}`,
    };
  } catch (e) {
    return { success: false, message: `推送失败: ${(e as Error).message}` };
  }
}

// ============ 主处理器 ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. 验证 Cron 密钥
    verifyCronSecret(req);

    // 2. 像素等性检查：当前小时是否已执行
    const supabase = getSupabaseAdmin();
    const executionHour = getCurrentHourId();
    const jobName = 'todo-remind';

    const alreadyExecuted = await hasExecutedThisHour(supabase, jobName, executionHour);
    if (alreadyExecuted) {
      console.log(`[TodoRemind] ${executionHour} 已执行，跳过`);
      return success(res, { message: `任务已于 ${executionHour} 执行，跳过本次` });
    }

    // 3. 查询所有需要提醒的待办
    // is_reminded=false 且 status=0（未完成）
    const { data: todos, error: queryError } = await supabase
      .from('todos')
      .select('*')
      .eq('is_reminded', false)
      .eq('status', 0);

    if (queryError) {
      console.error('[TodoRemind] 查询待办失败:', queryError.message);
      return error(res, 500, '查询待办失败');
    }

    if (!todos || todos.length === 0) {
      console.log('[TodoRemind] 没有需要提醒的待办');
      await recordExecution(supabase, jobName, executionHour, '没有需要提醒的待办');
      return success(res, { message: '没有需要提醒的待办', reminderCount: 0 });
    }

    // 4. 筛选出需要现在提醒的待办
    const now = new Date();
    const todosToRemind: typeof todos = [];

    for (const todo of todos) {
      const remindTime = calculateRemindTime(todo);

      // 如果提醒时间已到（提醒时间 <= 当前时间），则需要推送
      if (remindTime && remindTime.getTime() <= now.getTime()) {
        todosToRemind.push(todo);
      }
      // 如果没有 remind_offset 或无法计算提醒时间，按默认设置：
      // remind_offset=0 表示截止时间提醒（截止时间已过）
      else if (!todo.remind_offset || todo.remind_offset === 0) {
        // 检查是否有 deadline 且 deadline 已过
        if (todo.deadline) {
          const deadlineDate = new Date(todo.deadline);
          if (!isNaN(deadlineDate.getTime()) && deadlineDate.getTime() <= now.getTime()) {
            todosToRemind.push(todo);
          }
        }
      }
    }

    if (todosToRemind.length === 0) {
      console.log('[TodoRemind] 当前时间没有到达提醒时间的待办');
      await recordExecution(supabase, jobName, executionHour, `检查了 ${todos.length} 个待办，均未到提醒时间`);
      return success(res, { message: '当前没有需要提醒的待办', checkedCount: todos.length, reminderCount: 0 });
    }

    // 5. 按用户分组发送推送
    const userIds = [...new Set(todosToRemind.map((t) => t.user_id))];
    const pushResults: { userId: string; success: boolean; count: number; message: string }[] = [];

    for (const userId of userIds) {
      const userTodos = todosToRemind.filter((t) => t.user_id === userId);

      // 获取该用户的 Bark 订阅
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'bark');

      if (!subscriptions || subscriptions.length === 0) {
        pushResults.push({
          userId: userId.substring(0, 8) + '...',
          success: false,
          count: userTodos.length,
          message: '用户未配置 Bark 推送',
        });
        continue;
      }

      // 向第一个订阅的设备发送聚合通知
      // 如果只有一个待办，发送单条通知；多个待办则发送摘要
      if (userTodos.length === 1) {
        const result = await sendTodoReminder(userTodos[0], subscriptions[0]);
        pushResults.push({
          userId: userId.substring(0, 8) + '...',
          success: result.success,
          count: 1,
          message: result.message,
        });
      } else {
        // 多个待办时，汇总发送
        const summary = `你有 ${userTodos.length} 个待办事项需要处理：\n${userTodos
          .map((t) => `• ${t.title || '待办事项'}`)
          .join('\n')}`;

        const decryptedEndpoint = decrypt(subscriptions[0].endpoint);
        try {
          const response = await fetch(decryptedEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: '⏰ 待办提醒',
              body: summary.substring(0, 500),
              group: 'WorkBuddy',
              level: 'timeSensitive',
              sound: 'notification',
            }),
          });
          pushResults.push({
            userId: userId.substring(0, 8) + '...',
            success: response.status === 200,
            count: userTodos.length,
            message: response.status === 200 ? '推送成功' : `推送失败: HTTP ${response.status}`,
          });
        } catch (e) {
          pushResults.push({
            userId: userId.substring(0, 8) + '...',
            success: false,
            count: userTodos.length,
            message: `推送失败: ${(e as Error).message}`,
          });
        }
      }
    }

    // 6. 标记所有已推送的待办为 is_reminded=true
    const todoIds = todosToRemind.map((t) => t.id);
    if (todoIds.length > 0) {
      const { error: updateError } = await supabase
        .from('todos')
        .update({ is_reminded: true, updated_at: new Date().toISOString() })
        .in('id', todoIds);

      if (updateError) {
        console.error('[TodoRemind] 更新待办提醒状态失败:', updateError.message);
      }
    }

    // 7. 记录执行结果
    const resultMsg = `检查了 ${todos.length} 个待办，触达 ${todosToRemind.length} 个（涉及 ${userIds.length} 个用户）`;
    await recordExecution(supabase, jobName, executionHour, resultMsg);

    console.log(`[TodoRemind] ${resultMsg}`);

    // 8. 返回结果
    return success(res, {
      executionHour,
      checkedCount: todos.length,
      reminderCount: todosToRemind.length,
      userCount: userIds.length,
      results: pushResults,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[TodoRemind] 执行失败:', e);
    return error(res, 500, 'Cron 任务执行失败');
  }
}
