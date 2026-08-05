/**
 * 倒数日页面
 * 整合 CountdownList（系统自动 + 用户项）+ CountdownForm（新增/编辑）+ 删除二次确认
 */
import { useState, useCallback } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { deleteCachedCountdown } from '@/lib/countdownCache';
import { useToast } from '@/hooks/useToast';
import { CountdownList } from '@/components/countdowns/CountdownList';
import { CountdownForm } from '@/components/countdowns/CountdownForm';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import type { Countdown } from '@/types';

export default function Countdowns() {
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Countdown | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Countdown | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleAdd = () => {
    setEditItem(null);
    setFormOpen(true);
  };

  const handleEdit = (c: Countdown) => {
    setEditItem(c);
    setFormOpen(true);
  };

  const handleRequestDelete = (c: Countdown) => {
    setDeleteTarget(c);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const userId = await getCurrentUserId();
    try {
      const { error } = await supabase
        .from('countdowns')
        .update({ is_deleted: true })
        .eq('id', deleteTarget.id)
        .eq('user_id', userId);
      if (error) throw error;
      await deleteCachedCountdown(deleteTarget.id);
      toast.success('已删除');
      handleSaved();
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    } finally {
      setConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 页面标题 + 新增按钮 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-dark dark:text-ink-light">倒数日</h2>
        <Button variant="primary" size="lg" onClick={handleAdd} className="rounded-full px-5">
          ＋ 新增倒数日
        </Button>
      </div>

      {/* 列表（系统自动 + 用户项） */}
      <CountdownList key={refreshKey} onEdit={handleEdit} onDelete={handleRequestDelete} />

      {/* 新增/编辑表单 */}
      <CountdownForm
        open={formOpen}
        editCountdown={editItem}
        onClose={() => {
          setFormOpen(false);
          setEditItem(null);
        }}
        onSaved={handleSaved}
      />

      {/* 删除二次确认 */}
      <ConfirmDialog
        open={confirmOpen}
        title="删除倒数日"
        content={`确定删除「${deleteTarget?.title}」吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
