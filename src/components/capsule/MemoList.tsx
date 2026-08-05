/**
 * 备忘录列表组件
 * 绿色系主题
 * 功能：五大分类筛选、置顶优先、标签展示、搜索、分页
 * 本地优先：先用 IndexedDB 缓存秒开，再后台从 Supabase 刷新
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { createLocalStore } from '@/lib/localDb';
import { escapeHtml } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Memo } from '@/types';

// ============ 常量定义 ============
const PAGE_SIZE = 12;

/** 分类列表 */
const CATEGORIES = [
  { value: '', label: '全部', icon: '📋' },
  { value: '默认', label: '默认', icon: '📌' },
  { value: '工作', label: '工作', icon: '💼' },
  { value: '学习', label: '学习', icon: '📚' },
  { value: '生活', label: '生活', icon: '🏠' },
  { value: '其他', label: '其他', icon: '📦' },
];

/** 分类颜色 */
const CATEGORY_COLORS: Record<string, string> = {
  '默认': 'bg-forest/10 text-forest border-forest/20',
  '工作': 'bg-blue-100 text-blue-600 border-blue-200',
  '学习': 'bg-amber-100 text-amber-600 border-amber-200',
  '生活': 'bg-green-100 text-green-600 border-green-200',
  '其他': 'bg-gray-100 text-gray-600 border-gray-200',
};

/** 缓存 */
const memoStore = createLocalStore<Memo>('workbuddy-memos');

/**
 * 备忘录列表组件
 */
export function MemoList() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Memo | null>(null);
  const toast = useToast();

  // ============ 搜索防抖 ============
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ============ 数据加载（本地优先） ============

  const loadMemos = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    // 1. 本地缓存秒开
    try {
      const cached = await memoStore.getCached();
      if (cached.length > 0) {
        setMemos(cached);
        setLoading(false);
      }
    } catch {
      /* 忽略 */
    }

    // 2. 后台刷新（一次性取回全部，排序/筛选/分页均在前端完成）
    try {
      const { data, error } = await supabase
        .from('memos')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const list = (data || []) as Memo[];
      setMemos(list);
      await memoStore.setCached(list);
    } catch (e) {
      console.error('[MemoList] 加载失败:', e);
      if (memos.length === 0) toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [toast, memos.length]);

  useEffect(() => {
    loadMemos();
    // 仅挂载加载一次；分类/搜索均为前端筛选
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 每次本地数据变化都回写缓存 */
  useEffect(() => {
    if (memos.length > 0) memoStore.setCached(memos);
  }, [memos]);

  /** 加载更多（前端切片） */
  const loadMore = () => setVisibleCount((c) => c + PAGE_SIZE);

  // ============ 前端筛选 ============
  const filtered = useMemo(() => {
    const kw = debouncedSearch.trim().toLowerCase();
    return memos.filter((m) => {
      if (category && m.category !== category) return false;
      if (kw) {
        const hit =
          (m.title || '').toLowerCase().includes(kw) ||
          (m.content || '').toLowerCase().includes(kw) ||
          (m.tags || []).some((t) => t.toLowerCase().includes(kw));
        if (!hit) return false;
      }
      return true;
    });
  }, [memos, category, debouncedSearch]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  // ============ 操作 ============

  /** 切换置顶 */
  const togglePin = async (memo: Memo) => {
    const newValue = !memo.is_pinned;
    setMemos((prev) => prev.map((m) =>
      m.id === memo.id ? { ...m, is_pinned: newValue } : m
    ));

    const { error } = await supabase
      .from('memos')
      .update({ is_pinned: newValue })
      .eq('id', memo.id);

    if (error) {
      setMemos((prev) => prev.map((m) =>
        m.id === memo.id ? { ...m, is_pinned: memo.is_pinned } : m
      ));
      toast.error('操作失败');
    }
  };

  /** 软删除 */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('memos')
      .update({ is_deleted: true })
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('删除失败');
    } else {
      setMemos((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      toast.success('已删除');
    }
    setDeleteTarget(null);
  };

  // ============ 渲染 ============
  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <Input
        placeholder="搜索标题、内容或标签..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        prefixIcon={<span className="text-sm">🔍</span>}
      />

      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
              'active:scale-95 gpu-accelerated',
              category === cat.value
                ? 'bg-forest text-cream border-forest'
                : 'bg-cream dark:bg-forest-dark/50 text-secondary border-forest/15 hover:border-forest/40',
            ].join(' ')}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* 备忘录卡片网格 */}
      {loading && memos.length === 0 ? (
        <Loading text="加载备忘录..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="✏️"
          message="还没有备忘录，记下第一个灵感吧 ✏️"
          description="点击下方按钮创建你的第一条备忘录"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((memo) => (
              <Card
                key={memo.id}
                padding="md"
                className={[
                  'transition-all',
                  memo.is_pinned ? 'border-forest border-2' : '',
                ].join(' ')}
              >
                {/* 标题和置顶标记 */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light flex-1 min-w-0 truncate">
                    {memo.is_pinned && <span className="text-forest mr-1">📌</span>}
                    {escapeHtml(memo.title)}
                  </h3>
                  <button
                    onClick={() => togglePin(memo)}
                    className={[
                      'flex-shrink-0 text-xs transition-transform active:scale-110',
                      memo.is_pinned ? 'text-forest' : 'text-secondary/40',
                    ].join(' ')}
                    aria-label={memo.is_pinned ? '取消置顶' : '置顶'}
                  >
                    📌
                  </button>
                </div>

                {/* 摘要：截取前100字 */}
                <p className="text-xs text-secondary leading-relaxed mb-3 line-clamp-3">
                  {escapeHtml(memo.content).substring(0, 100)}
                  {memo.content.length > 100 ? '...' : ''}
                </p>

                {/* 分类标签 */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {memo.category && (
                    <span className={[
                      'px-2 py-0.5 rounded text-xs font-medium border',
                      CATEGORY_COLORS[memo.category] || '',
                    ].join(' ')}>
                      {memo.category}
                    </span>
                  )}
                  {memo.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-xs bg-forest/5 text-forest/70 border border-forest/10"
                    >
                      #{escapeHtml(tag)}
                    </span>
                  ))}
                </div>

                {/* 图片缩略图 */}
                {memo.image_urls && memo.image_urls.length > 0 && (
                  <div className="flex gap-1 mb-3 overflow-x-auto">
                    {memo.image_urls.slice(0, 3).map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt=""
                        className="w-12 h-12 rounded object-cover flex-shrink-0"
                        loading="lazy"
                      />
                    ))}
                    {memo.image_urls.length > 3 && (
                      <span className="text-xs text-secondary self-center">
                        +{memo.image_urls.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* 删除 */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setDeleteTarget(memo)}
                    className="text-xs text-secondary hover:text-accent-red transition-colors"
                  >
                    删除
                  </button>
                </div>
              </Card>
            ))}
          </div>

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
        </>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除备忘录"
        content={`确定要删除「${deleteTarget ? escapeHtml(deleteTarget.title).substring(0, 20) : ''}」吗？`}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
