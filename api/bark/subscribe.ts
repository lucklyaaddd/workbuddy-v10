/**
 * Bark 推送订阅保存接口
 * POST 请求，接收 barkUrl 和 deviceName，加密存储到数据库
 * 白名单校验：仅允许 https://api.day.app/ 开头的 URL
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, AuthError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

// 使用项目已有的加密工具函数
// 注意：这些函数位于 src/lib/crypto.ts，在 Vercel Serverless 环境中通过相对路径导入
// 但 API 目录下的文件需要引用 api/ 目录外的模块
// 这里通过创建 api/_lib/crypto.ts 的适配层来引用原始加密函数
import { encrypt, maskBarkUrl } from '../../src/lib/crypto';

/** Bark URL 白名单前缀 */
const BARK_URL_WHITELIST = ['https://api.day.app/'];

/** 最大设备名称长度 */
const MAX_DEVICE_NAME_LENGTH = 50;

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
 * 验证 Bark URL 是否在白名单内
 * @param url 用户提供的 Bark 推送 URL
 * @returns 是否有效
 */
function isValidBarkUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // 检查是否以任意白名单前缀开头
  const trimmedUrl = url.trim();
  return BARK_URL_WHITELIST.some((prefix) => trimmedUrl.startsWith(prefix));
}

/**
 * 验证并清理设备名称
 * @param name 原始设备名称
 * @returns 清理后的设备名称
 */
function sanitizeDeviceName(name: string | undefined): string {
  if (!name) return '未知设备';

  const trimmed = name.trim();
  if (trimmed.length === 0) return '未知设备';
  if (trimmed.length > MAX_DEVICE_NAME_LENGTH) {
    return trimmed.substring(0, MAX_DEVICE_NAME_LENGTH);
  }
  return trimmed;
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

    // 2. 解析请求体
    const { barkUrl, deviceName } = req.body || {};

    // 3. 验证 Bark URL 必填
    if (!barkUrl) {
      return error(res, 400, '缺少 barkUrl 参数');
    }

    // 4. 白名单校验
    if (!isValidBarkUrl(barkUrl)) {
      return error(res, 400, '仅支持 https://api.day.app/ 开头的 Bark URL');
    }

    // 5. 清理设备名称
    const cleanDeviceName = sanitizeDeviceName(deviceName);

    // 6. 加密 Bark URL 后存储
    const encryptedEndpoint = encrypt(barkUrl.trim());

    // 7. 插入到 push_subscriptions 表
    const supabase = getSupabaseAdmin();
    const { data, error: insertError } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        type: 'bark',
        endpoint: encryptedEndpoint,
        device_name: cleanDeviceName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Bark Subscribe] 存储订阅失败:', insertError.message);
      return error(res, 500, '保存订阅失败');
    }

    // 8. 返回脱敏后的 endpoint 和订阅 ID
    return success(res, {
      id: data.id,
      endpoint: maskBarkUrl(barkUrl.trim()),
      deviceName: cleanDeviceName,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[Bark Subscribe] 保存订阅时发生错误:', e);
    return error(res, 500, '保存订阅时发生服务器错误');
  }
}
