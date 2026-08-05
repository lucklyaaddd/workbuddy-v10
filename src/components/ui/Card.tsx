/**
 * 卡片组件
 * 毛玻璃卡片样式，支持 hover 效果和自定义内边距
 */
import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;        // 卡片内容
  hover?: boolean;            // 是否启用 hover 效果（默认开启）
  padding?: 'none' | 'sm' | 'md' | 'lg'; // 内边距
}

// 内边距对应样式
const paddingStyles = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

/**
 * 卡片组件
 * 使用 glass-card 样式 + 毛玻璃背景
 */
export function Card({
  children,
  hover = true,
  padding = 'md',
  className = '',
  ...restProps
}: CardProps) {
  return (
    <div
      className={[
        'glass-card relative overflow-hidden',
        hover ? 'hover:-translate-y-0.5 hover:shadow-lg' : '',
        paddingStyles[padding],
        className,
      ].join(' ')}
      {...restProps}
    >
      {children}
    </div>
  );
}

/**
 * 卡片标题组件
 */
export function CardHeader({ title, subtitle, action }: {
  title: string;             // 标题
  subtitle?: string;         // 副标题
  action?: ReactNode;        // 右侧操作区
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-base font-semibold text-ink-dark dark:text-ink-light">{title}</h3>
        {subtitle && <p className="text-xs text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
