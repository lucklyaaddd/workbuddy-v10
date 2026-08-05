/**
 * Toast 通知组件
 * 固定在屏幕顶部，自动消失，支持多种类型
 */
import { useToastStore } from '@/hooks/useToast';

// ============ 类型图标和颜色映射 ============
const typeConfig = {
  success: { icon: '✓', bg: 'bg-forest', border: 'border-forest-light' },
  error: { icon: '✕', bg: 'bg-accent-red', border: 'border-accent-red/80' },
  info: { icon: 'ℹ', bg: 'bg-oak-dark', border: 'border-oak' },
  warning: { icon: '⚠', bg: 'bg-accent-honey', border: 'border-accent-honey/80' },
} as const;

/**
 * Toast 通知容器
 * 固定在屏幕顶部，渲染所有 toast 消息
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pt-3 pointer-events-none"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
    >
      {toasts.map((toast) => {
        const config = typeConfig[toast.type];
        return (
          <div
            key={toast.id}
            className={[
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg',
              'text-cream text-sm font-medium border-2',
              'gpu-accelerated min-w-[200px] max-w-[90vw]',
              config.bg,
              config.border,
            ].join(' ')}
            style={{ animation: 'toastSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            onClick={() => removeToast(toast.id)}
          >
            {/* 类型图标 */}
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-cream/20 text-cream font-bold">
              {config.icon}
            </span>
            {/* 消息内容 */}
            <span className="flex-1">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============ Toast 动画样式注入 ============
const styleId = 'toast-animation-style';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes toastSlideDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}
