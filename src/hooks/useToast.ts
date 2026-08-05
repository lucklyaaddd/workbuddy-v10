/**
 * Toast 全局通知 Hook
 * 基于 zustand 创建的 toast 状态管理
 * 支持 success / error / info / warning 四种类型，自动消失
 */
import { create } from 'zustand';

// ============ 类型定义 ============
/** Toast 类型 */
type ToastType = 'success' | 'error' | 'info' | 'warning';

/** Toast 条目 */
interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;        // 自动关闭时长（毫秒）
}

/** Toast Store 接口 */
interface ToastState {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// 默认自动关闭时长
const DEFAULT_DURATION = 3000;

// ============ Toast Store ============
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  /**
   * 添加一条 Toast 通知
   * @param type 类型
   * @param message 消息内容
   * @param duration 自动关闭时长（默认 3 秒）
   */
  addToast: (type, message, duration = DEFAULT_DURATION) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));

    // 定时自动消失
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  /**
   * 移除指定 Toast
   */
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  /**
   * 清除所有 Toast
   */
  clearAll: () => set({ toasts: [] }),
}));

// ============ 便捷方法 Hook ============
/**
 * Toast 便捷调用 Hook
 * 返回 success / error / info / warning / clearAll 方法
 */
export function useToast() {
  const { addToast, removeToast, clearAll } = useToastStore();

  return {
    /** 成功提示 */
    success: (message: string, duration?: number) => addToast('success', message, duration),
    /** 错误提示 */
    error: (message: string, duration?: number) => addToast('error', message, duration),
    /** 信息提示 */
    info: (message: string, duration?: number) => addToast('info', message, duration),
    /** 警告提示 */
    warning: (message: string, duration?: number) => addToast('warning', message, duration),
    /** 移除单条 */
    remove: (id: string) => removeToast(id),
    /** 清除全部 */
    clearAll,
  };
}
