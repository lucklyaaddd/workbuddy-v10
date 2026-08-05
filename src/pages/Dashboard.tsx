/**
 * 今日中枢页面
 * 整合 TodoList + TodoForm + 任务统计饼图
 */
import { useState, useCallback } from 'react';
import { TodoList } from '@/components/dashboard/TodoList';
import { TodoForm } from '@/components/dashboard/TodoForm';
import { Button } from '@/components/ui/Button';
import type { Todo } from '@/types';

export default function Dashboard() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ============ 保存成功 ============
  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // ============ 打开新增 ============
  const handleAdd = () => {
    setEditTodo(null);
    setFormOpen(true);
  };

  // ============ 渲染 ============
  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-dark dark:text-ink-light">
          今日中枢
        </h2>
        <Button variant="primary" size="md" onClick={handleAdd}>
          + 新增待办
        </Button>
      </div>

      {/* 待办列表（内含饼图统计） */}
      <TodoList key={refreshKey} />

      {/* 新增/编辑弹窗 */}
      <TodoForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTodo(null); }}
        onSaved={handleSaved}
        editTodo={editTodo}
      />
    </div>
  );
}
