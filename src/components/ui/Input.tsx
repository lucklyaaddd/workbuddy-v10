/**
 * 输入框组件
 * 支持 label、placeholder、错误提示、前缀图标
 */
import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;              // 标签
  error?: string;              // 错误提示
  prefixIcon?: ReactNode;      // 前缀图标
  suffixIcon?: ReactNode;      // 后缀图标
}

/**
 * 输入框组件（使用 forwardRef 支持父组件 ref 转发）
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      error,
      prefixIcon,
      suffixIcon,
      className = '',
      id,
      ...restProps
    },
    ref,
  ) {
    return (
      <div className="w-full">
        {/* 标签 */}
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">
            {label}
          </label>
        )}
        {/* 输入框容器 */}
        <div className="relative">
          {/* 前缀图标 */}
          {prefixIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none flex items-center">
              {prefixIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={[
              'w-full rounded-lg border-2 px-3 py-2.5 text-sm outline-none transition-colors',
              'bg-cream dark:bg-forest-dark text-ink-dark dark:text-ink-light',
              'min-h-[44px]',
              error ? 'border-accent-red' : 'border-forest/20 focus:border-forest-light',
              prefixIcon ? 'pl-10' : '',
              suffixIcon ? 'pr-10' : '',
              className,
            ].join(' ')}
            {...restProps}
          />
          {/* 后缀图标 */}
          {suffixIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary flex items-center">
              {suffixIcon}
            </span>
          )}
        </div>
        {/* 错误提示 */}
        {error && <p className="mt-1 text-xs text-accent-red">{error}</p>}
      </div>
    );
  },
);
