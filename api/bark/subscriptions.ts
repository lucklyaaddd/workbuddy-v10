/**
 * Bark 推送订阅管理接口
 * GET:                获取当前用户所有推送订阅（endpoint 脱敏展示）
 * DELETE ?id=N:       删除指定推送订阅
 * DELETE ?all=1:      删除当前用户全部订阅（合并自原 api/bark/unsubscribe.ts，signOut 时调用）
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, AuthError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { decrypt, maskBarkUrl } from '../../src/lib/crypto';

// ============ 辅助函数 ============

/**
 * 处理跨域预检请求
 */
function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// ============ GET 处理器：获取订阅列表 ============

async function handleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const supabase = getSupabaseAdmin();

    // 查询当前用户的所有 Bark 推送订阅
    const { data: subscriptions, error: queryError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'bark')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[Bark Subscriptions] 查询订阅失败:', queryError.message);
      return error(res, 500, '查询推送订阅失败');
    }

    if (!subscriptions || subscriptions.length === 0) {
      return success(res, []);
    }

    // 脱敏 endpoint 并构建返回数据
    const safeSubscriptions = subscriptions.map((sub) => ({
      id: sub.id,
      type: sub.type,
      deviceName: sub.device_name || '未知设备',
      endpoint: maskBarkUrl(
        // 尝试解密获取 endpoint 并脱敏
        (() => {
          try {
            return decrypt(sub.endpoint);
          } catch {
            return '****';
          }
        })()
      ),
      createdAt: sub.created_at,
      updatedAt: sub.updated_at,
    }));

    return success(res, safeSubscriptions);
  } catch (e) {
    console.error('[Bark Subscriptions] 获取订阅列表失败:', e);
    return error(res, 500, '获取订阅列表失败');
  }
}

// ============ DELETE 处理器：删除指定订阅或全部订阅 ============
//
// 支持两种模式（合并了原 api/bark/unsubscribe.ts 的功能）：
//   1. DELETE /api/bark/subscriptions?id=N    → 删除单个订阅
//   2. DELETE /api/bark/subscriptions?all=1   → 删除当前用户全部订阅（登出清理用）
//
async function handleDelete(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const supabase = getSupabaseAdmin();
    const wantsAll = req.query.all === '1' || req.query.all === 'true';

    // 模式 1: 批量删除当前用户所有订阅
    if (wantsAll) {
      const { count, error: countError } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        console.error('[Bark Subscriptions] 查询订阅数量失败:', countError.message);
        return error(res, 500, '查询订阅记录失败');
      }

      if (!count || count === 0) {
        return success(res, { deletedCount: 0 }, '没有需要清理的订阅');
      }

      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('[Bark Subscriptions] 批量删除失败:', deleteError.message);
        return error(res, 500, '清理订阅记录失败');
      }

      return success(res, { deletedCount: count }, `已清理 ${count} 个设备订阅`);
    }

    // 模式 2: 删除单个订阅
    const subscriptionId = parseInt(
      (req.query.id as string) || (req.body?.id as string) || '',
      10
    );

    if (!subscriptionId || isNaN(subscriptionId)) {
      return error(res, 400, '缺少有效的订阅 ID');
    }

    // 先验证订阅属于当前用户
    const { data: subscription, error: findError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id')
      .eq('id', subscriptionId)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') {
        return error(res, 404, '订阅记录不存在');
      }
      console.error('[Bark Subscriptions] 查询订阅失败:', findError.message);
      return error(res, 500, '查询订阅记录失败');
    }

    // 验证归属
    if (subscription.user_id !== userId) {
      return error(res, 403, '无权操作此订阅');
    }

    // 删除订阅
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('id', subscriptionId);

    if (deleteError) {
      console.error('[Bark Subscriptions] 删除订阅失败:', deleteError.message);
      return error(res, 500, '删除订阅失败');
    }

    return success(res, { id: subscriptionId }, '订阅已删除');
  } catch (e) {
    console.error('[Bark Subscriptions] 删除订阅失败:', e);
    return error(res, 500, '删除订阅失败');
  }
}

// ============ 主处理器 ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 处理 CORS 预检请求
  if (handleCors(req, res)) return;

  try {
    // 验证用户身份
    const userId = await verifyAuth(req);

    // 根据 HTTP 方法分发
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, userId);
      case 'DELETE':
        return await handleDelete(req, res, userId);
      default:
        return error(res, 405, '仅支持 GET 和 DELETE 请求');
    }
  } catch (e) {
    if (e instanceof AuthError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[Bark Subscriptions] 处理请求时发生错误:', e);
    return error(res, 500, '处理请求时发生服务器错误');
  }
}
