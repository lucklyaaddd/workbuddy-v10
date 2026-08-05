/**
 * 备忘录页面占位组件
 */
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Memos() {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-ink-dark dark:text-ink-light">备忘录</h3>
      <Card>
        <EmptyState
          icon="📝"
          message="还没有备忘录"
          description="随手记下重要的事情"
        />
      </Card>
    </div>
  );
}
