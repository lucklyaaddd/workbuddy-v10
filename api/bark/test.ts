/**
 * Bark 推送测试接口
 * POST 请求，发送测试推送到用户所有设备
 * 30 秒冷却期（防止频繁测试）
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, checkCooldown, AuthError, RateLimitError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { decrypt } from '../../src/lib/crypto';

/** 测试推送冷却时间（毫秒） */
const TEST_COOLDOWN_MS = 30 * 1000;

/** 测试推送动作标识 */
const TEST_ACTION = 'bark_test_push';

/** 测试推送模板 */
const TEST_TITLE = '📢 推送测试';
const TEST_BODY = '🎉 这是一条来自 WorkBuddy 的测试推送！如果你收到了这条消息，说明推送配置正确。';

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

/**
 * 向指定设备发送测试推送
 * @param endpoint 解密的 Bark URL
 * @returns 推送结果
 */
async function sendTestPush(
  endpoint: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: TEST_TITLE,
        body: TEST_BODY,
        group: 'WorkBuddy',
        level: 'timeSensitive',
        sound: 'notification',
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 200) {
      return { success: true, message: '推送成功' };
    }

    return {
      success: false,
      message: `推送失败: ${(data as any).message || `HTTP ${response.status}`}`,
    };
  } catch (e) {
    return {
      success: false,
      message: `推送请求失败: ${(e as Error).message}`,
    };
  }
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

    // 2. 冷却检查：30 秒内不允许重复测试
    await checkCooldown(userId, TEST_ACTION, TEST_COOLDOWN_MS);

    // 3. 获取用户的 Bark 推送订阅
    const supabase = getSupabaseAdmin();
    const { data: subscriptions, error: queryError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'bark');

    if (queryError) {
      console.error('[Bark Test] 查询订阅失败:', queryError.message);
      return error(res, 500, '查询推送订阅失败');
    }

    if (!subscriptions || subscriptions.length === 0) {
      return error(res, 404, '未找到 Bark 推送订阅，请先添加设备');
    }

    // 4. 向所有设备发送测试推送
    const results: { device: string; success: boolean; message: string }[] = [];

    for (const sub of subscriptions) {
      try {
        // 解密 endpoint
        const decryptedEndpoint = decrypt(sub.endpoint);

        // 发送测试推送
        const result = await sendTestPush(decryptedEndpoint);

        results.push({
          device: sub.device_name || '未知设备',
          success: result.success,
          message: result.message,
        });
      } catch (decryptError) {
        console.error(`[Bark Test] 解密订阅 #${sub.id} 失败:`, decryptError);
        results.push({
          device: sub.device_name || '未知设备',
          success: false,
          message: '解密订阅失败',
        });
      }
    }

    // 5. 返回测试结果
    const allSuccess = results.every((r) => r.success);

    return success(res, {
      allSuccess,
      totalDevices: results.length,
      successCount: results.filter((r) => r.success).length,
      results,
    });
  } catch (e) {
    if (e instanceof AuthError || e instanceof RateLimitError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[Bark Test] 测试推送时发生错误:', e);
    return error(res, 500, '测试推送时发生服务器错误');
  }
}
