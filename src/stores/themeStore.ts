/**
 * 主题状态管理（Zustand）
 * 支持 light / dark / system 三种模式
 * 持久化到 localStorage
 */
import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

// 从 localStorage 读取主题设置
function getStoredTheme(): Theme {
  const stored = localStorage.getItem('workbuddy-theme');
  return (stored as Theme) || 'light';
}

// 判断当前是否为深色模式
function checkIsDark(theme: Theme): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  // system：跟随系统偏好
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// 应用主题到 DOM
function applyTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.backgroundColor = '#1A2A1A';
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.backgroundColor = '#FDF8EC';
  }
  // 更新 theme-color meta 标签
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', isDark ? '#1A3C2A' : '#FDF8EC');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  isDark: false,

  setTheme: (theme: Theme) => {
    localStorage.setItem('workbuddy-theme', theme);
    const isDark = checkIsDark(theme);
    applyTheme(isDark);
    set({ theme, isDark });
  },

  toggleTheme: () => {
    const current = get().isDark;
    const newTheme = current ? 'light' : 'dark';
    get().setTheme(newTheme);
  },

  initTheme: () => {
    const theme = getStoredTheme();
    const isDark = checkIsDark(theme);
    applyTheme(isDark);
    set({ theme, isDark });

    // 监听系统主题变化（当 theme=system 时生效）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (get().theme === 'system') {
        const dark = e.matches;
        applyTheme(dark);
        set({ isDark: dark });
      }
    });
  },
}));
