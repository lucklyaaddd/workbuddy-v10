/**
 * 认证 Hook
 * 封装 authStore，提供便捷的认证状态和方法
 */
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@supabase/supabase-js';

/**
 * 认证 Hook
 * 提供登录、登出、当前用户信息等功能
 */
export function useAuth() {
  const store = useAuthStore();
  const { user, loading, initialized, login, logout, init } = store;

  return {
    user,                    // 当前登录用户
    loading,                 // 登录中状态
    initialized,             // 初始化完成标志
    isAuthenticated: !!user, // 是否已登录
    login,                   // 登录方法
    logout,                  // 登出方法
    init,                    // 初始化方法
  };
}

// ============ 类型便捷导出 ============
export type AuthUser = User;
