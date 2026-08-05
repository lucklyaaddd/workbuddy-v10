/**
 * Supabase 管理员客户端（后端专用）
 * 使用 service_role_key 创建管理员客户端，绕过 RLS，仅后端使用
 * 前端永远无法获取 service_role_key
 */
import { createClient } from '@supabase/supabase-js';

/** Supabase 管理员客户端单例 */
let adminClient: ReturnType<typeof createClient> | null = null;

/**
 * 获取 Supabase 管理员客户端实例
 * 使用 service_role_key 创建，拥有数据库完全访问权限
 * @returns Supabase 管理员客户端
 */
export function getSupabaseAdmin() {
  if (!adminClient) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('[SupabaseAdmin] 环境变量 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 未配置');
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        // 后端不需要自动刷新 token
        autoRefreshToken: false,
        // 后端不持久化会话
        persistSession: false,
      },
    });
  }
  return adminClient;
}
