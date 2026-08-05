/**
 * 智能提醒中心页面
 * 整合 ReminderList + ReminderForm + ReminderCalendar
 */
import { useState, useCallback } from 'react';
import { ReminderList } from '@/components/reminders/ReminderList';
import { ReminderForm } from '@/components/reminders/ReminderForm';
import { ReminderCalendar } from '@/components/reminders/ReminderCalendar';
import { Button } from '@/components/ui/Button';
import type { Reminder } from '@/types';

export default function Reminders() {
  const [formOpen, setFormOpen] = useState(false);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);

  // ============ 保存成功 ============
  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // ============ 编辑 ============
  const handleEdit = (reminder: Reminder) => {
    setEditReminder(reminder);
    setFormOpen(true);
  };

  // ============ 新增 ============
  const handleAdd = () => {
    setEditReminder(null);
    setFormOpen(true);
  };

  // ============ 渲染 ============
  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-dark dark:text-ink-light">
          智能提醒中心
        </h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowCalendar(!showCalendar)}
          >
            {showCalendar ? '📋 列表' : '📅 日历'}
          </Button>
          <Button variant="primary" size="md" onClick={handleAdd}>
            + 新建提醒
          </Button>
        </div>
      </div>

      {/* 内容 */}
      {showCalendar ? (
        <ReminderCalendar refreshKey={refreshKey} />
      ) : (
        <ReminderList
          refreshKey={refreshKey}
          onEdit={handleEdit}
        />
      )}

      {/* 新增/编辑弹窗 */}
      <ReminderForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditReminder(null); }}
        onSaved={handleSaved}
        editReminder={editReminder}
      />
    </div>
  );
}
