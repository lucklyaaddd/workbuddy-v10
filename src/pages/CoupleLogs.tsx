/**
 * 情侣日志页面占位组件
 */
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CoupleLogs() {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-ink-dark dark:text-ink-light">情侣日志</h3>
      <Card>
        <EmptyState
          icon="💕"
          message="还没有日志记录"
          description="记录你们之间的美好时刻"
        />
      </Card>
    </div>
  );
}
