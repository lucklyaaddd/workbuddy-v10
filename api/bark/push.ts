/**
 * Bark 推送发送接口
 * POST 请求，接收推送参数，从数据库获取用户所有 Bark 订阅并发送推送
 * 频率限制：单用户每小时 10 条，每日 50 条
 * 如果 Bark 返回 404/401，自动删除失效订阅
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, rateLimit, AuthError, RateLimitError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { decrypt } from '../../src/lib/crypto';

/** 推送参数接口 */
interface PushParams {
  title: string;
  body?: string;
  group?: string;
  url?: string;
  level?: string;
  sound?: string;
  badge?: number;
  category?: string;
}

/** 每用户每小时推送限制 */
const HOURLY_LIMIT = 10;

/** 每用户每日推送限制 */
const DAILY_LIMIT = 50;

/** 统一的推送分组名 */
const PUSH_GROUP = 'WorkBuddy';

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
 * 验证推送参数
 * @param params 推送参数
 * @returns 错误消息，null 表示验证通过
 */
function validatePushParams(params: PushParams): string | null {
  if (!params.title || typeof params.title !== 'string') {
    return '缺少 title 参数';
  }

  if (params.title.length > 100) {
    return '标题长度不能超过 100 个字符';
  }

  if (params.body && params.body.length > 500) {
    return '正文长度不能超过 500 个字符';
  }

  return null;
}

/**
 * 发送单条 Bark 推送
 * @param endpoint 解密的 Bark URL
 * @param params 推送参数
 * @returns 推送结果 { success: boolean, statusCode: number, message: string }
 */
async function sendBarkPush(
  endpoint: string,
  params: PushParams
): Promise<{ success: boolean; statusCode: number; message: string }> {
  try {
    // 构建 Bark API 请求体
    // 参考: https://bark.day.app/#/tutorial
    const body: Record<string, any> = {
      title: params.title,
      device_key: endpoint.split('/').pop(), // 提取 device key
    };

    if (params.body) body.body = params.body;
    if (params.group) body.group = params.group;
    if (params.url) body.url = params.url;
    if (params.sound) body.sound = params.sound;
    if (params.badge !== undefined) body.badge = params.badge;
    if (params.category) body.category = params.category;

    // iOS 16.2+ 支持 level 参数
    // timeSensitive: 即使开启专注模式也能通知
    body.level = params.level || 'timeSensitive';

    // 构建推送 URL，统一使用分组
    const pushUrl = `https://api.day.app/push`;
    // 如果 endpoint 格式为 https://api.day.app/KEY，则直接用 endpoint
    const finalUrl = endpoint.startsWith('https://api.day.app/') ? endpoint : pushUrl;

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        // 如果 endpoint 包含完整路径，使用 endpoint 路径中的 key
        device_key: endpoint.split('/').pop(),
      }),
    });

    const responseData = await response.json().catch(() => ({}));

    if (response.status === 200) {
      return { success: true, statusCode: 200, message: '推送成功' };
    }

    // Bark API 错误码处理
    if (response.status === 404) {
      return { success: false, statusCode: 404, message: '设备未找到或已注销' };
    }

    if (response.status === 401 || response.status === 403) {
      return { success: false, statusCode: 401, message: '密钥无效或未授权' };
    }

    return {
      success: false,
      statusCode: response.status,
      message: (responseData as any).message || '推送失败',
    };
  } catch (e) {
    return { success: false, statusCode: 0, message: `推送请求失败: ${(e as Error).message}` };
  }
}

/**
 * 删除失效的 Bast 订阅记录
 * @param supabase Supabase 管理员客户端
 * @param subscriptionId 订阅记录 ID
 */
async function removeInvalidSubscription(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  subscriptionId: number
): Promise<void> {
  try {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('id', subscriptionId);

    console.log(`[Bark Push] 已删除失效订阅 #${subscriptionId}`);
  } catch (e) {
    console.error(`[Bark Push] 删除失效订阅 #${subscriptionId} 失败:`, e);
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

    // 2. 解析并验证推送参数
    const params = req.body as PushParams;

    const validationError = validatePushParams(params);
    if (validationError) {
      return error(res, 400, validationError);
    }

    // 3. 频率限制：每小时 10 次，每日 50 次
    // 注意：每日限制使用更大的窗口，但会累积计数
    await rateLimit(userId, 'bark_push_hourly', HOURLY_LIMIT, 60 * 60 * 1000);
    await rateLimit(userId, 'bark_push_daily', DAILY_LIMIT, 24 * 60 * 60 * 1000);

    // 4. 获取用户的 Bark 推送订阅
    const supabase = getSupabaseAdmin();
    const { data: subscriptions, error: queryError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'bark');

    if (queryError) {
      console.error('[Bark Push] 查询订阅失败:', queryError.message);
      return error(res, 500, '查询推送订阅失败');
    }

    if (!subscriptions || subscriptions.length === 0) {
      return error(res, 404, '未找到 Bark 推送订阅，请先添加设备');
    }

    // 5. 设置统一分组
    const pushParams: PushParams = {
      ...params,
      group: PUSH_GROUP,
      level: params.level || 'timeSensitive',
    };

    // 6. 向所有已订阅设备发送推送
    const results: { device: string; success: boolean; message: string }[] = [];

    for (const sub of subscriptions) {
      try {
        // 解密 endpoint
        const decryptedEndpoint = decrypt(sub.endpoint);

        // 发送推送
        const result = await sendBarkPush(decryptedEndpoint, pushParams);

        results.push({
          device: sub.device_name || '未知设备',
          success: result.success,
          message: result.message,
        });

        // 如果 Bark 返回 404 或 401，自动删除失效订阅
        if (result.statusCode === 404 || result.statusCode === 401) {
          await removeInvalidSubscription(supabase, sub.id);
        }
      } catch (decryptError) {
        // 解密失败，记录错误并继续处理其他订阅
        console.error(`[Bark Push] 解密订阅 #${sub.id} 失败:`, decryptError);
        results.push({
          device: sub.device_name || '未知设备',
          success: false,
          message: '解密订阅失败',
        });
      }
    }

    // 7. 返回推送结果
    return success(res, {
      totalDevices: subscriptions.length,
      results,
    });
  } catch (e) {
    if (e instanceof AuthError || e instanceof RateLimitError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[Bark Push] 发送推送时发生错误:', e);
    return error(res, 500, '发送推送时发生服务器错误');
  }
}
