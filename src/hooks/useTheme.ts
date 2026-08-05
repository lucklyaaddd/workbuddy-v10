/**
 * 主题 Hook
 * 封装 themeStore，提供便捷的主题设置方法
 */
import { useThemeStore } from '@/stores/themeStore';

// 主题类型
type Theme = 'light' | 'dark' | 'system';

/**
 * 主题 Hook
 * 提供 light / dark / system 三种模式切换
 */
export function useTheme() {
  const store = useThemeStore();
  const { theme, isDark, setTheme, toggleTheme, initTheme } = store;

  return {
    theme,          // 当前主题设置
    isDark,         // 当前是否深色模式
    setTheme,       // 设置主题
    toggleTheme,    // 在 light/dark 间切换
    initTheme,      // 初始化主题
  };
}

// 类型导出
export type { Theme };
