/**
 * 认证状态管理（Zustand）
 * 管理用户登录状态、用户信息
 */
import { create } from 'zustand';
import { supabase, signInWithEmail, signOut as supabaseSignOut } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  // 登录
  login: (email: string, password: string) => Promise<{ error?: string }>;
  // 退出
  logout: () => Promise<void>;
  // 初始化（从持久化会话恢复）
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  /**
   * 初始化：从 localStorage 恢复会话
   */
  init: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, initialized: true });
      } else {
        set({ user: null, initialized: true });
      }

      // 监听认证状态变化
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user || null });
      });
    } catch {
      set({ user: null, initialized: true });
    }
  },

  /**
   * 登录
   */
  login: async (email: string, password: string) => {
    set({ loading: true });
    const { error } = await signInWithEmail(email, password);
    set({ loading: false });
    if (error) {
      return { error: error.message };
    }
    return {};
  },

  /**
   * 退出登录
   * 清理会话和离线数据
   */
  logout: async () => {
    await supabaseSignOut();
    set({ user: null });
  },
}));
