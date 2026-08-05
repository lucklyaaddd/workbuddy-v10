/**
 * 按钮组件
 * 支持多种样式变体、尺寸、加载状态、禁用状态
 */
import { ButtonHTMLAttributes, ReactNode } from 'react';

// ============ 类型定义 ============
/** 按钮变体 */
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/** 按钮尺寸 */
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;     // 样式变体
  size?: ButtonSize;           // 尺寸
  loading?: boolean;          // 加载中状态
  leftIcon?: ReactNode;        // 左侧图标
  rightIcon?: ReactNode;       // 右侧图标
  fullWidth?: boolean;         // 是否撑满宽度
  children?: ReactNode;        // 按钮内容
}

// ============ 样式映射 ============
// 变体对应的背景/文字/边框色
const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-forest text-cream border-forest-dark hover:bg-forest/90',
  secondary: 'bg-transparent text-forest border-forest hover:bg-forest/10',
  danger: 'bg-accent-red text-cream border-accent-red/80 hover:bg-accent-red/90',
  ghost: 'bg-transparent text-secondary border-transparent hover:bg-forest/10',
};

// 尺寸对应的内边距和字体大小
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[36px]',
  md: 'px-4 py-2.5 text-sm min-h-[44px]',
  lg: 'px-6 py-3.5 text-base min-h-[52px]',
};

/**
 * 按钮组件
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  className = '',
  ...restProps
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2',
        'rounded-lg font-semibold border-2 cursor-pointer select-none',
        'transition-all duration-150 active:scale-95 gpu-accelerated',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? 'w-full' : '',
        disabled || loading ? 'opacity-50 cursor-not-allowed active:scale-100' : '',
        className,
      ].join(' ')}
      disabled={disabled || loading}
      {...restProps}
    >
      {/* 加载中旋转图标 */}
      {loading && (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {/* 左侧图标 */}
      {!loading && leftIcon}
      {/* 按钮文字 */}
      {children}
      {/* 右侧图标 */}
      {!loading && rightIcon}
    </button>
  );
}
