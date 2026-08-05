/**
 * 好词好句列表组件
 * 功能：卡片展示、分类筛选、全文搜索、一键导出 TXT、分页
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { escapeHtml } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import type { Quote, QuoteCategory } from '@/types';

// ============ 常量定义 ============
const PAGE_SIZE = 20;

/** 分类列表 */
const CATEGORIES: { value: QuoteCategory | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: '励志', label: '励志' },
  { value: '哲思', label: '哲思' },
  { value: '爱情', label: '爱情' },
  { value: '古诗词', label: '古诗词' },
  { value: '生活', label: '生活' },
];

/** 分类标签颜色 */
const CATEGORY_COLORS: Record<string, string> = {
  '励志': 'bg-forest/10 text-forest border-forest/20',
  '哲思': 'bg-oak/10 text-oak-dark border-oak/20',
  '爱情': 'bg-accent-red/10 text-accent-red border-accent-red/20',
  '古诗词': 'bg-accent-honey/10 text-oak-dark border-accent-honey/20',
  '生活': 'bg-forest-light/10 text-forest-light border-forest-light/20',
};

/**
 * 好词好句列表组件
 */
export function QuoteList() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [category, setCategory] = useState<QuoteCategory | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const toast = useToast();

  // ============ 搜索防抖 ============
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ============ 数据加载 ============

  /** 加载好词好句列表 */
  const loadQuotes = useCallback(async (reset = false) => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    setLoading(true);
    let query = supabase
      .from('quotes')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    // 分类筛选
    if (category) {
      query = query.eq('category', category);
    }

    // 全文搜索
    if (debouncedSearch) {
      query = query.or(`content.ilike.%${debouncedSearch}%,author.ilike.%${debouncedSearch}%`);
    }

    const currentOffset = reset ? 0 : offset;
    const { data, error } = await query.range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (error) {
      toast.error('加载失败');
      setLoading(false);
      return;
    }

    const list = (data || []) as Quote[];
    if (reset) {
      setQuotes(list);
      setOffset(PAGE_SIZE);
    } else {
      setQuotes((prev) => [...prev, ...list]);
      setOffset((prev) => prev + PAGE_SIZE);
    }
    setHasMore(list.length === PAGE_SIZE);
    setLoading(false);
  }, [offset, category, debouncedSearch, toast]);

  useEffect(() => {
    loadQuotes(true);
  }, [category, debouncedSearch]);

  /** 加载更多 */
  const loadMore = () => {
    if (!loading && hasMore) loadQuotes();
  };

  // ============ 导出 TXT ============

  /** 一键导出 TXT */
  const handleExport = () => {
    if (quotes.length === 0) {
      toast.warning('没有可导出的内容');
      return;
    }

    const lines = quotes.map((q) => {
      const author = q.author ? `—— ${q.author}` : '';
      const source = q.source ? `（来源：${q.source}）` : '';
      return `${q.content}\n${author}${source}`;
    });

    const text = lines.join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `好词好句_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  };

  // ============ 渲染 ============
  return (
    <div className="space-y-4">
      {/* 顶部工具栏：搜索 + 导出 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="搜索内容或作者..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefixIcon={<span className="text-sm">🔍</span>}
          />
        </div>
        <Button variant="secondary" size="md" onClick={handleExport}>
          📄 导出 TXT
        </Button>
      </div>

      {/* 分类筛选标签 */}
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
            {cat.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      {loading && quotes.length === 0 ? (
        <Loading text="加载好词好句中..." />
      ) : quotes.length === 0 ? (
        <EmptyState
          icon="📖"
          message="还没收藏任何句子，去发现打动人心的文字吧 📖"
          description="点击下方按钮添加你的第一个好词好句"
        />
      ) : (
        <>
          {/* 卡片网格：响应式 1/2/3 列 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quotes.map((quote) => (
              <Card key={quote.id} padding="md" className="flex flex-col">
                {/* 分类标签 */}
                {quote.category && (
                  <span
                    className={[
                      'self-start px-2 py-0.5 rounded text-xs font-medium border mb-2',
                      CATEGORY_COLORS[quote.category] || 'bg-forest/10 text-forest border-forest/20',
                    ].join(' ')}
                  >
                    {quote.category}
                  </span>
                )}

                {/* 内容：使用引号装饰 */}
                <p className="text-sm text-ink-dark dark:text-ink-light leading-relaxed italic flex-1">
                  "{escapeHtml(quote.content)}"
                </p>

                {/* 作者和来源 */}
                <div className="mt-3 pt-3 border-t border-forest/10">
                  {quote.author && (
                    <p className="text-xs font-medium text-forest">
                      —— {escapeHtml(quote.author)}
                    </p>
                  )}
                  {quote.source && (
                    <p className="text-xs text-secondary mt-0.5">
                      来源：{escapeHtml(quote.source)}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}
