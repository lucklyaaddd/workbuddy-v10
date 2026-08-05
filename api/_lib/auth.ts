/**
 * 认证辅助函数
 * 提供 JWT 验证、Cron 密钥验证、频率限制等共享功能
 */
import type { VercelRequest } from '@vercel/node';
import { getSupabaseAdmin } from './supabaseAdmin';

/**
 * 从 Authorization header 提取 JWT，验证用户身份，返回 userId
 * @param req Vercel 请求对象
 * @returns 已验证的 userId
 * @throws 未认证或 token 无效时抛出错误
 */
export async function verifyAuth(req: VercelRequest): Promise<string> {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  // 提取 Bearer token
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new AuthError('未提供认证令牌', 401);
  }

  try {
    // 使用 Supabase Admin 客户端验证 JWT（获取用户信息）
    const supabase = getSupabaseAdmin();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new AuthError('认证令牌无效或已过期', 401);
    }

    return user.id;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError('认证令牌无效或已过期', 401);
  }
}

/**
 * 验证 Cron 请求的密钥
 * 检查 x-cron-secret header 或 Authorization header
 * @param req Vercel 请求对象
 * @throws 密钥无效时抛出错误
 */
export function verifyCronSecret(req: VercelRequest): void {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new AuthError('CRON_SECRET 环境变量未配置', 500);
  }

  // 优先检查 x-cron-secret header
  const headerSecret = req.headers['x-cron-secret'] as string;
  if (headerSecret === cronSecret) return;

  // 其次检查 Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = extractBearerToken(authHeader);
  if (token === cronSecret) return;

  throw new AuthError('未经授权的 Cron 请求', 403);
}

/**
 * 简单的频率限制（基于数据库 operation_logs 表查询）
 * @param userId 用户 ID
 * @param action 操作类型标识
 * @param limit 限制次数
 * @param windowMs 时间窗口（毫秒）
 * @throws 超过限制时抛出错误
 */
export async function rateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  // 查询时间窗口内的操作记录数
  const { count, error: countError } = await supabase
    .from('operation_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart);

  if (countError) {
    console.error('[RateLimit] 查询操作记录失败:', countError.message);
    // 查询失败时不阻止操作（降级策略）
    return;
  }

  if (count && count >= limit) {
    throw new RateLimitError(`操作频率超限，请稍后再试（${limit}次/${Math.ceil(windowMs / 60000)}分钟）`, 429);
  }

  // 记录本次操作
  const { error: insertError } = await supabase
    .from('operation_logs')
    .insert({ user_id: userId, action, created_at: new Date().toISOString() });

  if (insertError) {
    console.error('[RateLimit] 记录操作日志失败:', insertError.message);
    // 记录失败不阻止操作
  }
}

/**
 * 检查冷却时间
 * 用于防止短时间内重复操作（如测试推送）
 * @param userId 用户 ID
 * @param action 操作类型标识
 * @param cooldownMs 冷却时间（毫秒）
 * @throws 冷却期内时抛出错误
 */
export async function checkCooldown(
  userId: string,
  action: string,
  cooldownMs: number
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('operation_logs')
    .select('created_at')
    .eq('user_id', userId)
    .eq('action', action)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = 无记录，正常情况
    console.error('[Cooldown] 查询操作记录失败:', error.message);
    return;
  }

  if (data) {
    const lastActionTime = new Date(data.created_at).getTime();
    const elapsed = Date.now() - lastActionTime;

    if (elapsed < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
      throw new RateLimitError(
        `操作过于频繁，请 ${remainingSeconds} 秒后再试`,
        429
      );
    }
  }
}

// ============ 内部辅助函数 ============

/**
 * 从 Authorization header 提取 Bearer token
 * @param header Authorization header 值（可能是字符串或字符串数组）
 * @returns token 字符串或 null
 */
function extractBearerToken(header: string | string[] | undefined): string | null {
  if (!header) return null;

  const headerStr = Array.isArray(header) ? header[0] : header;

  // 使用正则提取 Bearer token
  const match = headerStr.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// ============ 自定义错误类 ============

/** 认证错误 */
export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/** 频率限制错误 */
export class RateLimitError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = statusCode;
  }
}
