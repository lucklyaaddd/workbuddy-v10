/**
 * 记账列表组件
 * 功能：按日期分组展示、收入绿色/支出红色、显示分类图标金额备注、编辑删除、分页
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { escapeHtml, formatAmount, formatRelativeTime } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Transaction } from '@/types';

// ============ 常量定义 ============
const PAGE_SIZE = 20;

/** 分类图标映射 */
const CATEGORY_ICONS: Record<string, string> = {
  '餐饮': '🍜', '交通': '🚗', '购物': '🛍️', '娱乐': '🎮',
  '医疗': '🏥', '住房': '🏠', '教育': '📚',
  '工资': '💼', '奖金': '🎁', '投资': '📈',
  '其他支出': '📦', '其他收入': '💰',
};

// ============ 类型定义 ============
interface TransactionListProps {
  refreshKey: number;    // 外部刷新信号
  onEdit: (t: Transaction) => void;
}

/** 按日期分组的记录 */
interface DateGroup {
  date: string;
  items: Transaction[];
  totalIncome: number;
  totalExpense: number;
}

/**
 * 记账列表组件
 */
export function TransactionList({ refreshKey, onEdit }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const toast = useToast();

  // ============ 数据加载 ============

  /** 加载记录 */
  const loadTransactions = useCallback(async (reset = false) => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    setLoading(true);
    const currentOffset = reset ? 0 : offset;
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (error) {
      toast.error('加载失败');
      setLoading(false);
      return;
    }

    const list = (data || []) as Transaction[];
    if (reset) {
      setTransactions(list);
      setOffset(PAGE_SIZE);
    } else {
      setTransactions((prev) => [...prev, ...list]);
      setOffset((prev) => prev + PAGE_SIZE);
    }
    setHasMore(list.length === PAGE_SIZE);
    setLoading(false);
  }, [offset, toast]);

  useEffect(() => {
    loadTransactions(true);
  }, [refreshKey]);

  /** 加载更多 */
  const loadMore = () => {
    if (!loading && hasMore) loadTransactions();
  };

  // ============ 删除 ============

  /** 软删除 */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('transactions')
      .update({ is_deleted: true })
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('删除失败');
    } else {
      setTransactions((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success('已删除');
    }
    setDeleteTarget(null);
  };

  // ============ 按日期分组 ============

  /** 按日期分组，并计算每组合计数 */
  const groupedByDate = (): DateGroup[] => {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach((t) => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });

    return Object.entries(groups).map(([date, items]) => ({
      date,
      items,
      totalIncome: items.filter((i) => i.type === 'income').reduce((s, i) => s + i.amount, 0),
      totalExpense: items.filter((i) => i.type === 'expense').reduce((s, i) => s + i.amount, 0),
    }));
  };

  const groups = groupedByDate();

  // ============ 渲染 ============
  if (loading && transactions.length === 0) {
    return <Loading text="加载记录中..." />;
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon="💰"
        message="还没有记账记录，记下第一笔收支吧 💰"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 按日期分组 */}
      {groups.map((group) => (
        <div key={group.date}>
          {/* 日期标题 */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-semibold text-ink-dark dark:text-ink-light">
              {group.date}
            </span>
            <div className="flex gap-3 text-xs">
              {group.totalExpense > 0 && (
                <span className="text-accent-red font-medium">
                  支出 ¥{formatAmount(group.totalExpense)}
                </span>
              )}
              {group.totalIncome > 0 && (
                <span className="text-forest font-medium">
                  收入 ¥{formatAmount(group.totalIncome)}
                </span>
              )}
            </div>
          </div>

          {/* 该日记录列表 */}
          <div className="space-y-1.5">
            {group.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cream dark:bg-forest-dark/30 border border-forest/5 transition-all hover:border-forest/20"
              >
                {/* 分类图标 */}
                <span className="text-xl flex-shrink-0">
                  {CATEGORY_ICONS[item.category] || '📦'}
                </span>

                {/* 信息和金额 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink-dark dark:text-ink-light">
                      {escapeHtml(item.category)}
                    </span>
                    <span
                      className={[
                        'text-sm font-semibold',
                        item.type === 'income' ? 'text-forest' : 'text-accent-red',
                      ].join(' ')}
                    >
                      {item.type === 'income' ? '+' : '-'}¥{formatAmount(item.amount)}
                    </span>
                  </div>
                  {item.note && (
                    <p className="text-xs text-secondary mt-0.5 truncate">
                      {escapeHtml(item.note)}
                    </p>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onEdit(item)}
                    className="w-7 h-7 flex items-center justify-center rounded text-secondary hover:text-forest hover:bg-forest/10 transition-colors"
                    aria-label="编辑"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="w-7 h-7 flex items-center justify-center rounded text-secondary hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                    aria-label="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 加载更多 */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={loadMore}
            disabled={loading}
            className="text-xs text-forest hover:text-forest/70 transition-colors"
          >
            {loading ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除记录"
        content="确定要删除这条记账记录吗？"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
