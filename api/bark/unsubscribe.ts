/**
 * Bark 推送取消订阅接口
 * POST 请求，登出时清理当前用户所有设备订阅记录
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, AuthError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

// ============ 辅助函数 ============

/**
 * 处理跨域预检请求
 */
function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// ============ 主处理器 ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 处理 CORS 预检请求
  if (handleCors(req, res)) return;

  // 仅允许 POST 方法
  if (req.method !== 'POST') {
    return error(res, 405, '仅支持 POST 请求');
  }

  try {
    // 1. 验证用户身份
    const userId = await verifyAuth(req);

    // 2. 获取 Supabase 管理员客户端
    const supabase = getSupabaseAdmin();

    // 3. 先查询该用户的订阅数量，用于返回结果
    const { count, error: countError } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('[Bark Unsubscribe] 查询订阅数量失败:', countError.message);
      return error(res, 500, '查询订阅记录失败');
    }

    if (!count || count === 0) {
      return success(res, { deletedCount: 0 }, '没有需要清理的订阅');
    }

    // 4. 删除当前用户的所有 push_subscriptions 记录
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[Bark Unsubscribe] 删除订阅失败:', deleteError.message);
      return error(res, 500, '清理订阅记录失败');
    }

    // 5. 返回清理结果
    return success(
      res,
      { deletedCount: count },
      `已清理 ${count} 个设备订阅`
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[Bark Unsubscribe] 清理订阅时发生错误:', e);
    return error(res, 500, '清理订阅时发生服务器错误');
  }
}
