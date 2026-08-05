/**
 * 待办列表组件
 * 功能：加载当天待办、展示列表、状态切换、软删除、饼图统计
 * 响应式：移动端饼图在上列表在下，PC 端左右布局
 * 本地优先：先用 IndexedDB 缓存秒开，再后台从 Supabase 刷新
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { createLocalStore } from '@/lib/localDb';
import { escapeHtml, today } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Todo } from '@/types';
import { TodoStatus } from '@/types';

// ============ 类型定义 ============
/** 页面大小 */
const PAGE_SIZE = 20;

/** 饼图颜色映射 */
const PIE_COLORS: Record<string, string> = {
  已完成: '#5A7A4A', // 苔藓绿
  未完成: '#E8A87C', // 温暖橙
  超时: '#D64550',   // 像素红
};

/** 状态标签映射 */
const STATUS_LABELS: Record<number, string> = {
  [TodoStatus.PENDING]: '未完成',
  [TodoStatus.COMPLETED]: '已完成',
  [TodoStatus.TIMEOUT]: '超时',
};

/** 本地缓存 */
const todoStore = createLocalStore<Todo>('workbuddy-todos');

/**
 * 待办列表组件
 */
export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState<Todo | null>(null);
  // 饼图筛选联动：null=全部，否则按分类筛选
  const [pieFilter, setPieFilter] = useState<string | null>(null);
  const toast = useToast();
  // 是否已向用户展示过数据（用于避免在「已有缓存」时误报网络错误）
  const shownRef = useRef(false);

  // ============ 数据加载（本地优先） ============

  /** 加载当天待办：先用缓存秒开，再后台刷新 */
  const loadTodos = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    // 1. 本地缓存秒开
    try {
      const cached = (await todoStore.getCached()).filter(
        (t) => t.scheduled_date === today()
      );
      if (cached.length > 0) {
        setTodos(cached);
        shownRef.current = true;
        setLoading(false);
      }
    } catch {
      /* 忽略缓存读取失败 */
    }

    // 2. 后台从 Supabase 刷新
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const all = (data || []) as Todo[];
      const todayList = all.filter((t) => t.scheduled_date === today());
      setTodos(todayList);
      await todoStore.setCached(todayList);
      shownRef.current = true;
    } catch (e) {
      console.error('[TodoList] 加载失败:', e);
      if (!shownRef.current) toast.error('加载待办失败');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTodos();
    // 仅挂载时加载一次；筛选/翻转都在前端完成
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 每次本地数据变化都回写缓存，保证离线兜底始终最新 */
  useEffect(() => {
    if (todos.length > 0) todoStore.setCached(todos);
  }, [todos]);

  /** 加载更多（前端切片） */
  const loadMore = () => setVisibleCount((c) => c + PAGE_SIZE);

  // ============ 操作 ============

  /** 切换完成状态 */
  const toggleStatus = async (todo: Todo) => {
    const newStatus = todo.status === TodoStatus.COMPLETED
      ? TodoStatus.PENDING
      : TodoStatus.COMPLETED;

    // 乐观更新
    setTodos((prev) => prev.map((t) =>
      t.id === todo.id ? { ...t, status: newStatus } : t
    ));

    const { error } = await supabase
      .from('todos')
      .update({ status: newStatus })
      .eq('id', todo.id);

    if (error) {
      // 回滚
      setTodos((prev) => prev.map((t) =>
        t.id === todo.id ? { ...t, status: todo.status } : t
      ));
      toast.error('更新失败');
    }
  };

  /** 软删除 */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('todos')
      .update({ is_deleted: true })
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('删除失败');
    } else {
      setTodos((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success('已删除');
    }
    setDeleteTarget(null);
  };

  // ============ 饼图数据 ============

  /** 计算饼图数据 */
  const pieData = [
    { name: '已完成', value: todos.filter((t) => t.status === TodoStatus.COMPLETED).length },
    { name: '未完成', value: todos.filter((t) => t.status === TodoStatus.PENDING).length },
    { name: '超时', value: todos.filter((t) => t.status === TodoStatus.TIMEOUT).length },
  ].filter((d) => d.value > 0);

  /** 根据饼图筛选过滤列表 */
  const filteredTodos = pieFilter
    ? todos.filter((t) => STATUS_LABELS[t.status] === pieFilter)
    : todos;

  /** 饼图点击筛选 */
  const handlePieClick = (entry: any) => {
    if (entry?.name) {
      setPieFilter(pieFilter === entry.name ? null : entry.name);
    }
  };

  /** 当前显示的（已筛选 + 分页切片） */
  const visibleTodos = filteredTodos.slice(0, visibleCount);
  const hasMore = filteredTodos.length > visibleCount;

  // ============ 状态样式 ============

  /** 获取待办项的视觉样式 */
  const getStatusStyle = (status: TodoStatus) => {
    switch (status) {
      case TodoStatus.COMPLETED:
        return 'opacity-60 line-through';
      case TodoStatus.TIMEOUT:
        return 'border-l-4 border-l-accent-red bg-accent-red/5';
      default:
        return '';
    }
  };

  // ============ 渲染 ============

  if (loading && todos.length === 0) {
    return <Loading text="加载待办中..." />;
  }

  return (
    <div className="space-y-4">
      {/* 响应式布局容器 */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* 饼图区域：移动端在上，PC 端在左 */}
        {todos.length > 0 && (
          <div className="w-full md:w-2/5 lg:w-1/3 flex-shrink-0">
            <Card padding="md">
              <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-3">
                任务统计
              </h3>
              {/* recharts 饼图 */}
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      onClick={handlePieClick}
                      className="cursor-pointer"
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={PIE_COLORS[entry.name]}
                          stroke={pieFilter === entry.name ? '#1A3C2A' : 'transparent'}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} 项`, name]}
                      contentStyle={{
                        backgroundColor: '#FDF8EC',
                        border: '2px solid #5A7A4A',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* 图例 */}
              <div className="flex justify-center gap-4 mt-2">
                {pieData.map((d) => (
                  <button
                    key={d.name}
                    onClick={() => setPieFilter(pieFilter === d.name ? null : d.name)}
                    className={[
                      'flex items-center gap-1.5 text-xs transition-opacity',
                      pieFilter && pieFilter !== d.name ? 'opacity-40' : 'opacity-100',
                    ].join(' ')}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: PIE_COLORS[d.name] }}
                    />
                    <span className="text-secondary">{d.name} {d.value}</span>
                  </button>
                ))}
              </div>
              {/* 清除筛选 */}
              {pieFilter && (
                <p className="text-center text-xs text-forest mt-2 cursor-pointer" onClick={() => setPieFilter(null)}>
                  显示全部
                </p>
              )}
            </Card>
          </div>
        )}

        {/* 列表区域 */}
        <div className="flex-1 min-w-0">
          {filteredTodos.length === 0 ? (
            <EmptyState
              icon="🌱"
              message="今天还没有待办，给自己定个小目标吧 🌱"
              description="点击下方按钮添加新的待办事项"
            />
          ) : (
            <div className="space-y-2">
              {visibleTodos.map((todo) => (
                <div
                  key={todo.id}
                  className={[
                    'flex items-center gap-3 p-3 rounded-lg bg-cream dark:bg-forest-dark/50 border-2 border-forest/10',
                    'transition-all duration-200 gpu-accelerated',
                    getStatusStyle(todo.status),
                  ].join(' ')}
                >
                  {/* 状态复选框 */}
                  <button
                    onClick={() => toggleStatus(todo)}
                    className={[
                      'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      todo.status === TodoStatus.COMPLETED
                        ? 'bg-forest border-forest text-cream'
                        : 'border-forest/30 hover:border-forest',
                    ].join(' ')}
                    aria-label={todo.status === TodoStatus.COMPLETED ? '标记未完成' : '标记完成'}
                  >
                    {todo.status === TodoStatus.COMPLETED && (
                      <span className="text-xs">✓</span>
                    )}
                  </button>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-dark dark:text-ink-light break-words">
                      {escapeHtml(todo.content)}
                    </p>
                    {todo.scheduled_time && (
                      <p className="text-xs text-secondary mt-0.5">
                        {todo.scheduled_time}
                        {todo.remind_offset > 0 && ` · 提前${todo.remind_offset}分钟提醒`}
                      </p>
                    )}
                  </div>

                  {/* 删除按钮 */}
                  <button
                    onClick={() => setDeleteTarget(todo)}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-secondary hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                    aria-label="删除待办"
                  >
                    ✕
                  </button>
                </div>
              ))}

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
            </div>
          )}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除待办"
        content={`确定要删除「${deleteTarget ? escapeHtml(deleteTarget.content).substring(0, 30) : ''}」吗？`}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
