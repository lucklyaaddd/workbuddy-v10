/**
 * React 应用入口
 * 初始化各个 Store 和离线同步，延迟隐藏 splash-screen
 *
 * 【已加固】启动期连通性预检，提前暴露配置/网络问题
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { debugConfig } from '@/lib/supabase';
import './index.css';

// ============ Store 初始化 ============
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useSyncStore } from '@/stores/syncStore';
import { initOfflineSync } from '@/lib/offline-sync';

/**
 * 隐藏启动页 splash-screen
 */
function hideSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 300);
  }
}

/**
 * 启动期：连通性预检（仅开发模式）
 * 不阻塞启动，只在控制台输出诊断
 */
async function preflightCheck() {
  if (!import.meta.env.DEV) return;
  if (!debugConfig.isConfigured) {
    console.error(
      '%c[WorkBuddy] ❌ 环境变量未配置，登录将不可用',
      'color: #D64550; font-weight: bold; font-size: 14px;',
      '\n请在 E:\\mini-workbench\\.env 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY，然后重启 dev server'
    );
    return;
  }

  console.info('%c[WorkBuddy] 环境检测中...', 'color: #5A7A4A;');

  // 测试 1：浏览器在线状态
  if (!navigator.onLine) {
    console.warn('[WorkBuddy] ⚠️ 浏览器显示离线（navigator.onLine = false），登录会失败');
  } else {
    console.info('[WorkBuddy] ✅ 浏览器在线');
  }

  // 测试 2：HTTP 连通性
  const t0 = Date.now();
  try {
    const res = await fetch(debugConfig.supabaseUrl + '/auth/v1/health', {
      method: 'GET',
      headers: { apikey: debugConfig.supabaseKeyPreview.startsWith('sb_') ? '' : '' },
    });
    const elapsed = Date.now() - t0;
    console.info(`%c[WorkBuddy] ✅ Supabase 连通 (HTTP ${res.status}, ${elapsed}ms)`, 'color: #5A7A4A;');
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.error(
      `%c[WorkBuddy] ❌ Supabase 不可达 (${elapsed}ms)`,
      'color: #D64550; font-weight: bold; font-size: 14px;',
      '\n错误信息:', err,
      '\n可能原因：\n' +
        '  1. 浏览器扩展拦截了外部请求（请尝试无痕模式）\n' +
        '  2. 公司/校园代理阻止了 supabase.co\n' +
        '  3. 防火墙/安全软件拦截'
    );
  }
}

/**
 * 应用初始化
 */
async function bootstrap() {
  try {
    // 0. 启动期连通性预检（仅 dev，不阻塞）
    preflightCheck();

    // 1. 初始化认证状态（从 localStorage 恢复会话）
    const authStore = useAuthStore.getState();
    await authStore.init();

    // 2. 初始化主题
    const themeStore = useThemeStore.getState();
    themeStore.initTheme();

    // 3. 初始化同步状态监听
    const syncStore = useSyncStore.getState();
    syncStore.init();

    // 4. 初始化离线同步引擎
    initOfflineSync();
  } catch (err) {
    console.error('[App] 初始化失败', err);
  } finally {
    hideSplashScreen();
  }
}

// ============ 挂载 React 应用 ============
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 启动初始化流程
bootstrap();
