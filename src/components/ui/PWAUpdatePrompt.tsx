/**
 * PWA 更新提示组件
 * 检测到新 Service Worker 时弹窗提示用户刷新
 * 使用 vite-plugin-pwa 的 useRegisterSW
 */
import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './Button';

/**
 * PWA 更新提示弹窗
 * 当检测到新的 Service Worker 等待安装时弹出
 */
export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  // 注册 Service Worker 并监听更新
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url, registration) {
      // 注册成功
      console.log('[PWA] Service Worker 已注册:', url);
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker 注册失败:', error);
    },
  });

  // 需要刷新时显示弹窗
  if (needRefresh) {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-4 w-full max-w-sm rounded-2xl bg-cream dark:bg-forest-dark shadow-2xl overflow-hidden p-5"
          style={{ animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* 更新图标 */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🌿</span>
            <div>
              <h3 className="text-base font-semibold text-ink-dark dark:text-ink-light">发现新版本</h3>
              <p className="text-xs text-secondary mt-0.5">更新后体验更好的 WorkBuddy</p>
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 mt-4">
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setNeedRefresh(false)}
            >
              稍后再说
            </Button>
            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={showPrompt}
              onClick={() => {
                setShowPrompt(true);
                updateServiceWorker(true);
              }}
            >
              立即更新
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 离线就绪提示
  if (offlineReady) {
    return (
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-xl bg-forest text-cream text-sm shadow-lg flex items-center gap-3"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <span className="text-lg">📦</span>
        <span>应用已可离线使用</span>
        <button
          className="ml-2 text-cream/70 hover:text-cream"
          onClick={() => setOfflineReady(false)}
        >
          ✕
        </button>
      </div>
    );
  }

  return null;
}
