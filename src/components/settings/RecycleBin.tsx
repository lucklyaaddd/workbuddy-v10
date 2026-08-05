/**
 * 回收站组件
 * 功能：展示已软删除记录（按表分组）、30天内可恢复、显示剩余天数、清空回收站（危险操作二次确认）
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { escapeHtml } from '@/lib/utils';
import { differenceInDays, parseISO } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// ============ 常量定义 ============
const RETENTION_DAYS = 30; // 保留天数
const RECYCLE_TABLES = ['todos', 'transactions', 'quotes', 'memos', 'couple_logs', 'reminders'];

/** 表名中文映射 */
const TABLE_LABELS: Record<string, string> = {
  todos: '待办',
  transactions: '记账',
  quotes: '好词好句',
  memos: '备忘录',
  couple_logs: '情侣日志',
  reminders: '提醒',
};

/** 回收站中的单条记录 */
interface RecycledItem {
  id: string;
  table: string;
  content: string;
  deleted_at: string;
  days_remaining: number;
}

/**
 * 回收站组件
 */
export function RecycleBin() {
  const [items, setItems] = useState<RecycledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const toast = useToast();

  // ============ 数据加载 ============

  const loadRecycleBin = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    setLoading(true);
    const allItems: RecycledItem[] = [];

    for (const table of RECYCLE_TABLES) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        (data as any[]).forEach((record) => {
          const deletedAt = record.updated_at || record.created_at;
          const daysSinceDelete = differenceInDays(new Date(), parseISO(deletedAt));
          const daysRemaining = Math.max(0, RETENTION_DAYS - daysSinceDelete);

          // 提取可显示内容
          const displayContent = record.title || record.content || record.name || '';
          allItems.push({
            id: record.id,
            table,
            content: displayContent.substring(0, 50),
            deleted_at: deletedAt,
            days_remaining: daysRemaining,
          });
        });
      }
    }

    setItems(allItems);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecycleBin();
  }, [loadRecycleBin]);

  // ============ 按表分组 ============
  const groupedItems = items.reduce<Record<string, RecycledItem[]>>((acc, item) => {
    if (!acc[item.table]) acc[item.table] = [];
    acc[item.table].push(item);
    return acc;
  }, {});

  // ============ 恢复记录 ============
  const handleRestore = async (item: RecycledItem) => {
    const { error } = await supabase
      .from(item.table)
      .update({ is_deleted: false })
      .eq('id', item.id);

    if (error) {
      toast.error('恢复失败');
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success('已恢复');
    }
  };

  // ============ 清空回收站 ============
  const handleClear = async () => {
    setShowClearConfirm(false);
    setClearing(true);

    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      const { error } = await supabase
        .from(item.table)
        .delete()
        .eq('id', item.id);

      if (error) failCount++;
      else successCount++;
    }

    setClearing(false);
    if (failCount > 0) {
      toast.warning(`成功删除${successCount}条，${failCount}条失败`);
    } else {
      toast.success('回收站已清空');
    }

    loadRecycleBin();
  };

  // ============ 渲染 ============
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light">
          回收站
        </h3>
        {items.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
            loading={clearing}
          >
            清空回收站
          </Button>
        )}
      </div>

      <p className="text-xs text-secondary mb-3">
        删除的记录将保留{RETENTION_DAYS}天，到期后自动清除
      </p>

      {loading ? (
        <Loading size="sm" text="加载回收站..." />
      ) : items.length === 0 ? (
        <p className="text-xs text-secondary text-center py-4">回收站为空</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedItems).map(([table, tableItems]) => (
            <div key={table}>
              <h4 className="text-xs font-medium text-forest mb-1.5">
                📁 {TABLE_LABELS[table] || table}（{tableItems.length}）
              </h4>
              <div className="space-y-1">
                {tableItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-forest/5 dark:bg-forest-dark/30 text-xs"
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-ink-dark dark:text-ink-light truncate">
                        {escapeHtml(item.content)}
                      </p>
                      <p className="text-secondary">
                        {item.days_remaining > 0
                          ? `剩余 ${item.days_remaining} 天`
                          : '即将自动清除'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestore(item)}
                      className="flex-shrink-0 text-forest hover:text-forest/70 font-medium transition-colors"
                    >
                      恢复
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 清空确认 */}
      <ConfirmDialog
        open={showClearConfirm}
        title="清空回收站"
        content="确定要永久删除回收站中的所有记录吗？此操作不可撤销。"
        danger
        confirmText="清空"
        onConfirm={handleClear}
        onCancel={() => setShowClearConfirm(false)}
      />
    </Card>
  );
}
