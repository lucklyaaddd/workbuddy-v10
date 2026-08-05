/**
 * 提醒列表组件
 * 功能：三个分区（待处理/即将到来/历史）、类型图标、日期倒计时、农历标记、周期展示、编辑删除、分页
 * 本地优先：先用 IndexedDB 缓存秒开，再后台从 Supabase 刷新
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { createLocalStore } from '@/lib/localDb';
import { escapeHtml, solarToLunar } from '@/lib/utils';
import { differenceInDays, parseISO } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Reminder } from '@/types';

// ============ 常量定义 ============
const PAGE_SIZE = 20;

/** 提醒类型图标 */
const TYPE_ICONS: Record<string, string> = {
  birthday: '🎂',
  custom: '🔔',
};

/** 缓存 */
const reminderStore = createLocalStore<Reminder>('workbuddy-reminders');

/**
 * 提醒列表组件
 */
export function ReminderList({
  refreshKey,
  onEdit,
}: {
  refreshKey: number;
  onEdit: (r: Reminder) => void;
}) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const toast = useToast();

  // ============ 数据加载（本地优先） ============

  const loadReminders = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    // 1. 本地缓存秒开
    try {
      const cached = await reminderStore.getCached();
      if (cached.length > 0) {
        setReminders(cached);
        setLoading(false);
      }
    } catch {
      /* 忽略 */
    }

    // 2. 后台刷新
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('date', { ascending: true });

      if (error) throw error;

      const list = (data || []) as Reminder[];
      setReminders(list);
      await reminderStore.setCached(list);
    } catch (e) {
      console.error('[ReminderList] 加载失败:', e);
      if (reminders.length === 0) toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [toast, reminders.length]);

  useEffect(() => {
    loadReminders();
  }, [refreshKey]);

  /** 每次本地数据变化都回写缓存 */
  useEffect(() => {
    if (reminders.length > 0) reminderStore.setCached(reminders);
  }, [reminders]);

  const loadMore = () => setVisibleCount((c) => c + PAGE_SIZE);

  // ============ 删除 ============
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('reminders')
      .update({ is_deleted: true })
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('删除失败');
    } else {
      setReminders((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success('已删除');
    }
    setDeleteTarget(null);
  };

  // ============ 分区计算 ============

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  /** 计算倒计时天数 */
  const getDaysUntil = (date: string): number => {
    const target = parseISO(date);
    return differenceInDays(target, new Date(todayStr));
  };

  // 仅对当前分页窗口内的数据做分区
  const pageItems = reminders.slice(0, visibleCount);
  const hasMore = reminders.length > visibleCount;

  const { pending, upcoming, history } = useMemo(() => {
    const p: Reminder[] = [];
    const u: Reminder[] = [];
    const h: Reminder[] = [];

    pageItems.forEach((r) => {
      const days = getDaysUntil(r.date);
      if (r.status === 0) {
        if (days < 0) {
          h.push(r);
        } else if (days <= 3) {
          u.push(r);
        } else {
          p.push(r);
        }
      } else if (r.status === 1) {
        h.push(r);
      }
    });

    return { pending: p, upcoming: u, history: h };
  }, [pageItems, todayStr]);

  // ============ 渲染单条提醒 ============
  const renderReminder = (reminder: Reminder) => {
    const days = getDaysUntil(reminder.date);
    const lunarStr = reminder.lunar ? `农历 ${solarToLunar(reminder.date)}` : '';

    return (
      <div
        key={reminder.id}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cream dark:bg-forest-dark/30 border border-forest/5 transition-all hover:border-forest/20"
      >
        {/* 类型图标 */}
        <span className="text-2xl flex-shrink-0">
          {TYPE_ICONS[reminder.type] || '🔔'}
        </span>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink-dark dark:text-ink-light">
              {escapeHtml(reminder.name)}
            </span>
            {reminder.lunar && (
              <span className="text-xs text-oak-dark">农历</span>
            )}
            {reminder.repeat_yearly && (
              <span className="text-xs text-forest">每年</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-secondary">
            <span>{reminder.date}</span>
            {lunarStr && <span>{lunarStr}</span>}
            {reminder.cycle_type && reminder.cycle_type !== '单次' && (
              <span className="text-forest/70">{reminder.cycle_type}</span>
            )}
          </div>
          {reminder.note && (
            <p className="text-xs text-secondary/70 mt-0.5 truncate">
              {escapeHtml(reminder.note)}
            </p>
          )}
        </div>

        {/* 倒计时 */}
        {reminder.status === 0 && (
          <div className="flex-shrink-0 text-center min-w-[40px]">
            {days === 0 ? (
              <span className="text-xs font-bold text-accent-red">今天</span>
            ) : days > 0 ? (
              <>
                <span className="text-sm font-bold text-forest">{days}</span>
                <span className="block text-xs text-secondary">天后</span>
              </>
            ) : (
              <span className="text-xs text-secondary">已过</span>
            )}
          </div>
        )}

        {/* 操作 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(reminder)}
            className="w-7 h-7 flex items-center justify-center rounded text-secondary hover:text-forest hover:bg-forest/10 transition-colors"
          >
            ✎
          </button>
          <button
            onClick={() => setDeleteTarget(reminder)}
            className="w-7 h-7 flex items-center justify-center rounded text-secondary hover:text-accent-red hover:bg-accent-red/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  // ============ 渲染 ============
  if (loading && reminders.length === 0) {
    return <Loading text="加载提醒中..." />;
  }

  if (reminders.length === 0) {
    return (
      <EmptyState
        icon="⏰"
        message="还没有提醒，添加一个生日或待办事项吧 ⏰"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 即将到来 */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-accent-red mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accent-red animate-pulse" />
            即将到来
          </h3>
          <div className="space-y-1.5">
            {upcoming.map(renderReminder)}
          </div>
        </div>
      )}

      {/* 待处理 */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-forest mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-forest" />
            待处理
          </h3>
          <div className="space-y-1.5">
            {pending.map(renderReminder)}
          </div>
        </div>
      )}

      {/* 历史 */}
      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-secondary" />
            历史
          </h3>
          <div className="space-y-1.5 opacity-60">
            {history.map(renderReminder)}
          </div>
        </div>
      )}

      {/* 加载更多 */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={loadMore}
            className="text-xs text-forest hover:text-forest/70 transition-colors"
          >
            加载更多
          </button>
        </div>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除提醒"
        content={`确定要删除提醒「${deleteTarget ? escapeHtml(deleteTarget.name).substring(0, 20) : ''}」吗？`}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
