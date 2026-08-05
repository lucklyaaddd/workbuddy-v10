/**
 * 下拉选择组件
 * 支持 options、label、value、onChange
 */
import { SelectHTMLAttributes, ChangeEvent, ReactNode } from 'react';

/** 选项类型 */
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;              // 标签
  options: SelectOption[];    // 选项列表
  error?: string;              // 错误提示
  placeholder?: string;        // 占位符
  onChange?: (value: string) => void; // 值变化回调
  suffixIcon?: ReactNode;      // 后缀图标（预留）
}

/**
 * 下拉选择组件
 */
export function Select({
  label,
  options,
  error,
  placeholder,
  onChange,
  id,
  className = '',
  ...restProps
}: SelectProps) {
  // 处理值变化
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <div className="w-full">
      {/* 标签 */}
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">
          {label}
        </label>
      )}
      {/* 下拉框容器 */}
      <div className="relative">
        <select
          id={id}
          onChange={handleChange}
          className={[
            'w-full rounded-lg border-2 px-3 py-2.5 text-sm outline-none transition-colors',
            'bg-cream dark:bg-forest-dark text-ink-dark dark:text-ink-light',
            'min-h-[44px] appearance-none cursor-pointer',
            'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%3E%3Cpath%20d%3D%22M1%201l4%204%204-4%22%20stroke%3D%22%235A7A4A%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%2F%3E%3C%2Fsvg%3E")] bg-no-repeat',
            'bg-[length:10px] bg-[right_12px_center] pr-9',
            error ? 'border-accent-red' : 'border-forest/20 focus:border-forest-light',
            className,
          ].join(' ')}
          {...restProps}
        >
          {/* 占位符选项 */}
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {/* 选项列表 */}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {/* 错误提示 */}
      {error && <p className="mt-1 text-xs text-accent-red">{error}</p>}
    </div>
  );
}
