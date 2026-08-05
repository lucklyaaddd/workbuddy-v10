/**
 * 空状态组件
 * 接收 emoji 图标、消息、操作按钮，包含线条小狗装饰
 */
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: string;              // emoji 图标
  message: string;            // 提示消息
  description?: string;       // 补充描述
  actionText?: string;        // 操作按钮文字
  onAction?: () => void;      // 操作回调
  children?: ReactNode;       // 自定义底部内容
}

/**
 * 空状态组件
 * 包含线条小狗装饰和波点背景
 */
export function EmptyState({
  icon = '🍃',
  message,
  description,
  actionText,
  onAction,
  children,
}: EmptyStateProps) {
  return (
    <div className="empty-state relative py-12 px-6">
      {/* 波点背景装饰 */}
      <div className="absolute inset-0 dotted-bg opacity-30 pointer-events-none" />

      {/* 线条小狗装饰 */}
      <PixelDogDecoration />

      {/* 图标 */}
      <div className="text-5xl mb-4 animate-bounce-gentle relative z-10">
        {icon}
      </div>

      {/* 提示消息 */}
      <p className="text-sm font-medium text-secondary relative z-10">{message}</p>

      {/* 补充描述 */}
      {description && (
        <p className="text-xs text-secondary/70 mt-1 relative z-10">{description}</p>
      )}

      {/* 操作按钮 */}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-5 py-2.5 text-sm font-semibold rounded-lg bg-forest text-cream border-2 border-forest-dark hover:bg-forest/90 transition-all active:scale-95 min-h-[44px] relative z-10"
        >
          {actionText}
        </button>
      )}

      {children}
    </div>
  );
}

/**
 * 线条小狗装饰
 * 用 SVG 绘制的简约线条小狗
 */
function PixelDogDecoration() {
  return (
    <svg
      className="absolute bottom-0 right-4 opacity-10 pointer-events-none"
      width="80"
      height="60"
      viewBox="0 0 80 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 小狗身体轮廓 */}
      <path
        d="M10 40 Q10 30 20 28 L50 28 Q60 28 60 38 L60 48 Q60 52 56 52 L52 52 L50 48 L20 48 L18 52 L14 52 Q10 52 10 48 Z"
        stroke="#5A7A4A"
        strokeWidth="2"
        fill="none"
      />
      {/* 头部 */}
      <circle cx="60" cy="35" r="8" stroke="#5A7A4A" strokeWidth="2" fill="none" />
      {/* 耳朵 */}
      <path d="M56 28 L54 22 L58 24" stroke="#5A7A4A" strokeWidth="2" fill="none" />
      {/* 眼睛 */}
      <circle cx="62" cy="34" r="1" fill="#5A7A4A" />
      {/* 尾巴 */}
      <path d="M10 38 Q4 36 6 30" stroke="#5A7A4A" strokeWidth="2" fill="none" />
      {/* 腿 */}
      <line x1="22" y1="48" x2="22" y2="56" stroke="#5A7A4A" strokeWidth="2" />
      <line x1="48" y1="48" x2="48" y2="56" stroke="#5A7A4A" strokeWidth="2" />
    </svg>
  );
}
