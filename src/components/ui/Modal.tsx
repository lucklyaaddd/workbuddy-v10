/**
 * 模态框组件
 * 支持打开/关闭动画、遮罩点击关闭、ESC 键关闭、iOS 安全区适配
 */
import { useEffect, ReactNode, MouseEvent } from 'react';

interface ModalProps {
  open: boolean;              // 是否打开
  onClose: () => void;        // 关闭回调
  title?: string;             // 标题
  children: ReactNode;        // 内容
  footer?: ReactNode;         // 底部操作区
  closeOnMaskClick?: boolean; // 点击遮罩关闭（默认 true）
  maxWidth?: string;          // 最大宽度
}

/**
 * 模态框组件
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnMaskClick = true,
  maxWidth = '480px',
}: ModalProps) {
  // ESC 键关闭
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 打开时禁止 body 滚动
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  // 未打开不渲染
  if (!open) return null;

  // 遮罩点击
  const handleMaskClick = (e: MouseEvent<HTMLDivElement>) => {
    if (closeOnMaskClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    // 遮罩层
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleMaskClick}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* 模态框主体 */}
      <div
        className="relative w-full mx-4 rounded-2xl bg-cream dark:bg-forest-dark shadow-2xl overflow-hidden"
        style={{ maxWidth, animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* 标题栏 */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-forest/15">
            <h2 className="text-base font-semibold text-ink-dark dark:text-ink-light">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-secondary hover:bg-forest/10 transition-colors"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        )}

        {/* 内容区 */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto custom-scroll">
          {children}
        </div>

        {/* 底部操作区 */}
        {footer && (
          <div className="px-5 py-4 border-t border-forest/15 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 模态框动画 ============
// 注入关键帧动画（仅注入一次）
const styleId = 'modal-slide-up-style';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes modalSlideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
}
