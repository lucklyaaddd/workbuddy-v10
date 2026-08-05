/**
 * 文件删除接口
 * DELETE 请求，从 Supabase Storage 删除指定文件
 * 验证文件归属：路径前缀必须匹配 user_id
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, AuthError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

/** Supabase Storage Bucket 名称 */
const STORAGE_BUCKET = 'user-uploads';

// ============ 辅助函数 ============

/**
 * 处理跨域预检请求
 */
function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * 提取并验证文件路径
 * 从请求中获取文件标识，构建完整的 Storage 路径
 * @param req Vercel 请求对象
 * @param userId 当前用户 ID
 * @returns 完整的 Storage 文件路径
 */
function extractFilePath(req: VercelRequest, userId: string): string | null {
  // 从路径参数 [id] 获取文件 ID
  const fileId = req.query.id as string;

  if (!fileId) {
    return null;
  }

  // 安全检查：防止路径穿越攻击
  // 文件 ID 必须是合法的 UUID 格式
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(fileId)) {
    return null;
  }

  // 构建完整路径：{user_id}/{uuid}.webp
  return `${userId}/${fileId}.webp`;
}

// ============ 主处理器 ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 处理 CORS 预检请求
  if (handleCors(req, res)) return;

  // 仅允许 DELETE 方法
  if (req.method !== 'DELETE') {
    return error(res, 405, '仅支持 DELETE 请求');
  }

  try {
    // 1. 验证用户身份
    const userId = await verifyAuth(req);

    // 2. 提取并验证文件路径
    const filePath = extractFilePath(req, userId);

    if (!filePath) {
      return error(res, 400, '缺少有效的文件 ID 或文件 ID 格式不正确');
    }

    // 3. 验证文件归属：路径前缀必须匹配 user_id
    if (!filePath.startsWith(`${userId}/`)) {
      return error(res, 403, '无权操作此文件');
    }

    // 4. 获取 Supabase 管理员客户端
    const supabase = getSupabaseAdmin();

    // 5. 先检查文件是否存在
    const { data: exists, error: existsError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(userId, {
        search: filePath.split('/').pop(),
      });

    if (existsError) {
      console.error('[Files Delete] 检查文件存在失败:', existsError.message);
      return error(res, 500, '检查文件状态失败');
    }

    // 6. 删除文件
    const { error: deleteError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (deleteError) {
      console.error('[Files Delete] 删除文件失败:', deleteError.message);
      return error(res, 500, '删除文件失败');
    }

    // 7. 记录删除日志（脱敏）
    console.log(
      `[Files Delete] 用户 ${userId.substring(0, 8)}... 删除文件: ${filePath.split('/').pop()}`
    );

    // 8. 返回成功
    return success(res, { path: filePath }, '文件已删除');
  } catch (e) {
    if (e instanceof AuthError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[Files Delete] 删除文件时发生错误:', e);
    return error(res, 500, '删除文件时发生服务器错误');
  }
}
