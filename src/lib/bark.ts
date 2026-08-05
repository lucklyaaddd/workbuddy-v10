/**
 * Bark 推送前端工具
 * 安全规范：前端禁止直接调用 Bark API，所有推送请求经由 Vercel 函数中转
 * 前端仅负责将推送参数发送到后端 API
 */
import type { BarkPushParams } from '@/types';
import { getAccessToken } from './supabase';

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
 * 测试推送（带 30 秒冷却）
 * @param deviceName 设备名称
 * @returns 测试结果
 */
export async function testBarkPush(deviceName?: string): Promise<{ success: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: '未登录' };
  }

  try {
    const resp = await fetch('/api/bark/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ deviceName }),
    });

    const result = await resp.json();
    if (!resp.ok || !result.success) {
      return { success: false, error: result.error || '测试失败' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || '网络错误' };
  }
}

/**
 * 获取已绑定的设备列表
 * @returns 设备列表（endpoint 已脱敏）
 */
export async function getSubscriptions(): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const resp = await fetch('/api/bark/subscriptions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await resp.json();
    return result.data || [];
  } catch {
    return [];
  }
}

/**
 * 删除推送订阅
 * @param subscriptionId 订阅ID
 */
export async function deleteSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { success: false, error: '未登录' };

  try {
    const resp = await fetch(`/api/bark/subscriptions?id=${subscriptionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await resp.json();
    return { success: result.success, error: result.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
