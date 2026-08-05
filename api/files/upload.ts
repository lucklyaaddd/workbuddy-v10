/**
 * 文件上传接口
 * POST 请求 multipart/form-data，上传图片到 Supabase Storage
 * 支持魔数校验文件类型、文件大小限制、UUID 重命名、每日上传限制
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, rateLimit, AuthError, RateLimitError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { pipeline } from 'stream';

// 禁用默认 bodyParser，以便手动处理 multipart/form-data
export const config = { api: { bodyParser: false } };

/** 允许的 MIME 类型及其魔数 */
const ALLOWED_TYPES: Record<string, { magicBytes: number[][]; extension: string }> = {
  'image/jpeg': {
    magicBytes: [[0xff, 0xd8, 0xff]],
    extension: 'jpg',
  },
  'image/png': {
    magicBytes: [[0x89, 0x50, 0x4e, 0x47]],
    extension: 'png',
  },
  'image/gif': {
    magicBytes: [[0x47, 0x49, 0x46, 0x38]],
    extension: 'gif',
  },
  'image/webp': {
    magicBytes: [[0x52, 0x49, 0x46, 0x46]],
    extension: 'webp',
  },
};

/** 文件大小上限（字节） */
const MAX_FILE_SIZE = 200 * 1024; // 200KB

/** 每日上传次数限制 */
const DAILY_UPLOAD_LIMIT = 30;

/** Supabase Storage Bucket 名称 */
const STORAGE_BUCKET = 'user-uploads';

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
 * 通过魔数校验文件类型
 * @param buffer 文件内容的前几个字节
 * @returns 检测到的 MIME 类型，无法识别返回 null
 */
function detectFileType(buffer: Buffer): string | null {
  for (const [mimeType, config] of Object.entries(ALLOWED_TYPES)) {
    for (const bytes of config.magicBytes) {
      let match = true;
      for (let i = 0; i < bytes.length; i++) {
        if (buffer[i] !== bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) return mimeType;
    }
  }
  return null;
}

/**
 * 获取文件内容类型对应的扩展名
 * @param mimeType MIME 类型
 * @returns 扩展名
 */
function getExtension(mimeType: string): string {
  return ALLOWED_TYPES[mimeType]?.extension || 'unknown';
}

/**
 * 解析 multipart/form-data 请求体
 * 从请求中提取文件内容、文件名和字段
 * @param req Vercel 请求对象
 * @returns 包含 buffer、原始文件名、MIME 类型的对象
 */
async function parseFormData(req: VercelRequest): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: string;
} | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      // 提前拒绝超大文件（检查总请求体大小）
      if (totalSize > MAX_FILE_SIZE + 1024 * 100) {
        // 留一些余量给表单其他字段
        reject(new UploadError('文件大小超过限制（最大 200KB）', 413));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';

      // 验证 Content-Type 是 multipart/form-data
      if (!contentType.includes('multipart/form-data')) {
        reject(new UploadError('请求格式错误，需要 multipart/form-data', 400));
        return;
      }

      // 提取 boundary
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
      if (!boundaryMatch) {
        reject(new UploadError('无法解析表单边界', 400));
        return;
      }
      const boundary = boundaryMatch[1] || boundaryMatch[2];

      // 解析 multipart 各部分
      const parts = parseMultipart(rawBody, boundary);
      if (parts === null) {
        reject(new UploadError('无法解析表单数据', 400));
        return;
      }

      resolve(parts);
    });

    req.on('error', (e) => {
      reject(new UploadError(`请求处理失败: ${e.message}`, 500));
    });
  });
}

/**
 * 简易 multipart 解析器
 * 提取文件数据部分
 * @param body 原始请求体
 * @param boundary 表单边界标识
 */
function parseMultipart(
  body: Buffer,
  boundary: string
): { buffer: Buffer; filename: string; mimeType: string } | null {
  try {
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

    // 按 boundary 分割
    const parts: Buffer[] = [];
    let start = 0;

    while (start < body.length) {
      const idx = body.indexOf(boundaryBuffer, start);
      if (idx === -1) break;
      parts.push(body.subarray(start, idx));
      start = idx + boundaryBuffer.length + 2; // 跳过 boundary + CRLF
    }

    // 查找包含文件数据的部分
    for (const part of parts) {
      if (part.length === 0) continue;

      // 查找头部和数据的分隔位置（\r\n\r\n）
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;

      const headerStr = part.subarray(0, headerEnd).toString('utf-8');

      // 跳过非文件字段
      if (!headerStr.includes('filename=')) continue;

      // 提取文件名
      const filenameMatch = headerStr.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'unknown';

      // 提取文件内容（头部后的数据，去除末尾的 \r\n）
      let dataStart = headerEnd + 4;
      let dataEnd = part.length;

      // 去除末尾可能存在的 boundary 分隔符残留
      if (part[dataEnd - 1] === 0x0a) dataEnd--;
      if (part[dataEnd - 1] === 0x0d) dataEnd--;

      const fileBuffer = part.subarray(dataStart, dataEnd);

      // 通过魔数检测真实文件类型
      const detectedType = detectFileType(fileBuffer);
      if (!detectedType) {
        throw new UploadError('不支持的文件类型（仅支持 JPEG/PNG/GIF/WebP）', 400);
      }

      // 检查文件大小
      if (fileBuffer.length > MAX_FILE_SIZE) {
        throw new UploadError('文件大小超过限制（最大 200KB）', 413);
      }

      return {
        buffer: fileBuffer,
        filename,
        mimeType: detectedType,
      };
    }

    return null;
  } catch (e) {
    if (e instanceof UploadError) throw e;
    return null;
  }
}

/**
 * 生成存储路径：{user_id}/{uuid}.webp
 * @param userId 用户 ID
 * @param uuid 唯一标识符
 */
function generateStoragePath(userId: string, uuid: string): string {
  // 统一保存为 webp 格式以节省空间
  return `${userId}/${uuid}.webp`;
}

// ============ 自定义错误类 ============

class UploadError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'UploadError';
    this.statusCode = statusCode;
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

    // 2. 频率限制：每日 30 次上传
    await rateLimit(userId, 'file_upload', DAILY_UPLOAD_LIMIT, 24 * 60 * 60 * 1000);

    // 3. 解析 multipart/form-data
    const fileData = await parseFormData(req);

    if (!fileData) {
      return error(res, 400, '未找到上传文件');
    }

    // 4. 生成唯一文件名
    const fileUuid = uuidv4();
    const storagePath = generateStoragePath(userId, fileUuid);

    // 5. 上传到 Supabase Storage
    const supabase = getSupabaseAdmin();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileData.buffer, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Files Upload] 上传到 Storage 失败:', uploadError.message);
      return error(res, 500, '文件上传失败');
    }

    // 6. 获取文件公开访问 URL
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    // 7. 记录上传日志（脱敏）
    console.log(
      `[Files Upload] 用户 ${userId.substring(0, 8)}... 上传文件: ${fileData.filename} → ${fileUuid}.webp (${fileData.buffer.length} bytes)`
    );

    // 8. 返回结果
    return success(res, {
      id: fileUuid,
      path: storagePath,
      url: publicUrlData.publicUrl,
      originalName: fileData.filename,
      size: fileData.buffer.length,
      mimeType: fileData.mimeType,
    });
  } catch (e) {
    if (e instanceof AuthError || e instanceof RateLimitError) {
      return error(res, e.statusCode, e.message);
    }
    if (e instanceof UploadError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[Files Upload] 上传文件时发生错误:', e);
    return error(res, 500, '上传文件时发生服务器错误');
  }
}
