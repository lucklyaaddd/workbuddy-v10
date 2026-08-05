/**
 * 主题切换组件
 * 三个选项：浅色 / 深色 / 跟随系统
 */
import { useTheme } from '@/hooks/useTheme';
import { Card } from '@/components/ui/Card';

/**
 * 主题切换组件
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light', label: '☀️ 浅色', description: '奶油米黄背景，明亮舒适' },
    { value: 'dark', label: '🌙 深色', description: '深墨绿背景，护眼柔和' },
    { value: 'system', label: '💻 跟随系统', description: '自动匹配设备主题' },
  ];

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-3">
        主题模式
      </h3>

      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
            className={[
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left',
              'active:scale-[0.98] gpu-accelerated',
              theme === option.value
                ? 'border-forest bg-forest/10 dark:bg-forest-dark/50'
                : 'border-forest/15 bg-cream dark:bg-forest-dark/30 hover:border-forest/30',
            ].join(' ')}
          >
            {/* 选中指示 */}
            <div
              className={[
                'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                theme === option.value
                  ? 'border-forest bg-forest'
                  : 'border-forest/30',
              ].join(' ')}
            >
              {theme === option.value && (
                <span className="text-cream text-xs">✓</span>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-ink-dark dark:text-ink-light">
                {option.label}
              </p>
              <p className="text-xs text-secondary mt-0.5">
                {option.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
