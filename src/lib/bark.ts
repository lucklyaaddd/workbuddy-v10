/**
 * Bark 推送前端工具
 * 注意：推送主流程依赖 Vercel Serverless Functions，仅 Vercel 完整版可用
 * 列表/删除改为直连 Supabase（用 RLS 严格隔离数据），兼容 CloudStudio 镜像
 *
 * 安全规范：endpoint 字段是加密的，前端不调用解密；UI 上用 id 脱敏展示
 */
import type { BarkPushParams } from '@/types';
import { supabase, getAccessToken, getCurrentUserId } from './supabase';

/**
 * 发送推送请求（通过后端中转）
 * @param params 推送参数
 * @returns 推送结果
 */
export async function sendPushNotification(params: BarkPushParams): Promise<{ success: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: '未登录' };
  }

  try {
    const resp = await fetch('/api/bark/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    const result = await resp.json();
    if (!resp.ok || !result.success) {
      return { success: false, error: result.error || '推送失败' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || '网络错误' };
  }
}

/**
 * 保存 Bark 推送订阅（通过后端加密后存储）
 * @param barkUrl 完整 Bark 推送 URL
 * @param deviceName 设备名称
 * @returns 保存结果
 *
 * 注意：此接口依赖 Vercel Serverless Function（加密密钥仅存在于后端）。
 * 在 CloudStudio 镜像下会失败，需使用 Vercel 完整版。
 */
export async function saveBarkSubscription(barkUrl: string, deviceName: string): Promise<{ success: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: '未登录' };
  }

  // 前端验证 URL 格式（白名单校验）
  if (!barkUrl.startsWith('https://api.day.app/')) {
    return { success: false, error: 'Bark URL 必须以 https://api.day.app/ 开头' };
  }

  try {
    const resp = await fetch('/api/bark/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ barkUrl, deviceName }),
    });

    const result = await resp.json();
    if (!resp.ok || !result.success) {
      return { success: false, error: result.error || '保存失败' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || '网络错误' };
  }
}

/**
 * 获取已绑定的设备列表（直连 Supabase）
 * 走 supabase-js 自身的 RLS（policy: select_own），自动过滤只查当前用户
 * endpoint 字段是加密的，前端不解密；用 id 填充 endpoint 字段保持 UI 兼容
 * @returns 设备列表（兼容 BoundDevice 类型的 id/device_name/endpoint）
 */
export async function getSubscriptions(): Promise<any[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, type, device_name, created_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // endpoint 字段填充 id（让现有 maskEndpoint UI 仍能展示，
    // 同时密码安全：前端永远不会拿到明文 Bark URL）
    return (data || []).map((row) => ({
      id: row.id,
      type: row.type,
      device_name: row.device_name,
      created_at: row.created_at,
      endpoint: row.id, // 兼容 UI，前端不可解密原 URL
    }));
  } catch (err) {
    console.error('[Bark] getSubscriptions 失败:', err);
    return [];
  }
}

/**
 * 删除推送订阅（软删除，直连 Supabase）
 * @param subscriptionId 订阅 ID
 */
export async function deleteSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: '未登录' };

  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', subscriptionId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || '删除失败' };
  }
}
