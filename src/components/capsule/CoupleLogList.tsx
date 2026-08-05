/**
 * 情侣日志列表组件
 * 红粉色调主题
 * 功能：卡片展示、心情标签筛选、日历视图、收藏切换、图片九宫格预览、在一起天数、纪念日倒计时
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { escapeHtml, formatRelativeTime } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ImageViewer } from '@/components/common/ImageViewer';
import type { CoupleLog } from '@/types';

// ============ 常量定义 ============
const PAGE_SIZE = 12;

/** 心情标签列表 */
const MOOD_TAGS = [
  { value: '', label: '全部', emoji: '💕' },
  { value: '开心', label: '开心', emoji: '😊' },
  { value: '感动', label: '感动', emoji: '🥹' },
  { value: '甜蜜', label: '甜蜜', emoji: '🍯' },
  { value: '想念', label: '想念', emoji: '💭' },
  { value: '日常', label: '日常', emoji: '📝' },
  { value: '期待', label: '期待', emoji: '🌟' },
];

/** 心情颜色映射 */
const MOOD_COLORS: Record<string, string> = {
  '开心': 'bg-red-100 text-red-600 border-red-200',
  '感动': 'bg-pink-100 text-pink-600 border-pink-200',
  '甜蜜': 'bg-rose-100 text-rose-600 border-rose-200',
  '想念': 'bg-purple-100 text-purple-600 border-purple-200',
  '日常': 'bg-amber-100 text-amber-600 border-amber-200',
  '期待': 'bg-fuchsia-100 text-fuchsia-600 border-fuchsia-200',
};

/**
 * 情侣日志列表组件
 */
export function CoupleLogList() {
  const [logs, setLogs] = useState<CoupleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [moodFilter, setMoodFilter] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CoupleLog | null>(null);
  // 图片预览
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const toast = useToast();

  // ============ 数据加载 ============

  const loadLogs = useCallback(async (reset = false) => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    setLoading(true);
    let query = supabase
      .from('couple_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (moodFilter) {
      query = query.eq('mood', moodFilter);
    }
    if (starredOnly) {
      query = query.eq('is_starred', true);
    }

    const currentOffset = reset ? 0 : offset;
    const { data, error } = query.range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (error) {
      toast.error('加载失败');
      setLoading(false);
      return;
    }

    const list = (data || []) as CoupleLog[];
    if (reset) {
      setLogs(list);
      setOffset(PAGE_SIZE);
    } else {
      setLogs((prev) => [...prev, ...list]);
      setOffset((prev) => prev + PAGE_SIZE);
    }
    setHasMore(list.length === PAGE_SIZE);
    setLoading(false);
  }, [offset, moodFilter, starredOnly, toast]);

  useEffect(() => {
    loadLogs(true);
  }, [moodFilter, starredOnly]);

  const loadMore = () => {
    if (!loading && hasMore) loadLogs();
  };

  // ============ 在一起天数 ============

  const togetherDays = useMemo(() => {
    if (logs.length === 0) return null;
    // 从最早的日志日期开始计算
    const dates = logs.map((l) => new Date(l.log_date).getTime());
    const earliest = Math.min(...dates);
    const now = Date.now();
    return Math.floor((now - earliest) / (1000 * 60 * 60 * 24));
  }, [logs]);

  // ============ 日历标记日期 ============

  const markedDates = useMemo(() => {
    return new Set(logs.map((l) => l.log_date));
  }, [logs]);

  // ============ 操作 ============

  /** 切换收藏 */
  const toggleStarred = async (log: CoupleLog) => {
    const newValue = !log.is_starred;
    setLogs((prev) => prev.map((l) =>
      l.id === log.id ? { ...l, is_starred: newValue } : l
    ));

    const { error } = await supabase
      .from('couple_logs')
      .update({ is_starred: newValue })
      .eq('id', log.id);

    if (error) {
      setLogs((prev) => prev.map((l) =>
        l.id === log.id ? { ...l, is_starred: log.is_starred } : l
      ));
      toast.error('操作失败');
    }
  };

  /** 软删除 */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('couple_logs')
      .update({ is_deleted: true })
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('删除失败');
    } else {
      setLogs((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      toast.success('已删除');
    }
    setDeleteTarget(null);
  };

  /** 打开图片预览 */
  const openPreview = (images: string[], index: number) => {
    setPreviewImages(images);
    setPreviewIndex(index);
    setPreviewOpen(true);
  };

  // ============ 渲染 ============
  if (loading && logs.length === 0) {
    return <Loading text="加载回忆中..." />;
  }

  return (
    <div className="space-y-4">
      {/* 在一起天数 */}
      {togetherDays !== null && (
        <Card padding="md" className="text-center bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-red-200 dark:border-red-800">
          <p className="text-sm text-red-500 dark:text-red-400 font-medium">
            💞 已经在一起 {togetherDays} 天啦
          </p>
        </Card>
      )}

      {/* 心情标签筛选 */}
      <div className="flex flex-wrap gap-2">
        {MOOD_TAGS.map((mood) => (
          <button
            key={mood.value}
            onClick={() => setMoodFilter(mood.value)}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
              'active:scale-95 gpu-accelerated',
              moodFilter === mood.value
                ? 'bg-red-500 text-cream border-red-500'
                : 'bg-cream dark:bg-forest-dark/50 text-secondary border-forest/15 hover:border-red-300',
            ].join(' ')}
          >
            {mood.emoji} {mood.label}
          </button>
        ))}
      </div>

      {/* 收藏切换按钮 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStarredOnly(!starredOnly)}
          className={[
            'px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all',
            'active:scale-95 gpu-accelerated',
            starredOnly
              ? 'bg-amber-400 text-amber-900 border-amber-500'
              : 'bg-cream dark:bg-forest-dark/50 text-secondary border-forest/15',
          ].join(' ')}
        >
          ⭐ {starredOnly ? '精选' : '全部'}
        </button>
      </div>

      {/* 日志卡片网格 */}
      {logs.length === 0 ? (
        <EmptyState
          icon="💞"
          message="还没有记录，写下属于你们的第一个回忆吧 💞"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {logs.map((log) => (
              <Card
                key={log.id}
                padding="md"
                className="border-red-100 dark:border-red-900/30 hover:border-red-200 dark:hover:border-red-800 transition-all"
              >
                {/* 日期和心情 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-secondary">{log.log_date}</span>
                  <div className="flex items-center gap-1">
                    {log.mood && (
                      <span
                        className={[
                          'px-2 py-0.5 rounded text-xs font-medium border',
                          MOOD_COLORS[log.mood] || '',
                        ].join(' ')}
                      >
                        {log.mood}
                      </span>
                    )}
                    {/* 收藏按钮 */}
                    <button
                      onClick={() => toggleStarred(log)}
                      className={[
                        'text-sm transition-transform active:scale-110',
                        log.is_starred ? 'text-amber-400' : 'text-secondary/40',
                      ].join(' ')}
                      aria-label={log.is_starred ? '取消收藏' : '收藏'}
                    >
                      {log.is_starred ? '⭐' : '☆'}
                    </button>
                  </div>
                </div>

                {/* 内容 */}
                <p className="text-sm text-ink-dark dark:text-ink-light leading-relaxed mb-3">
                  {escapeHtml(log.content)}
                </p>

                {/* 图片九宫格 */}
                {log.image_urls && log.image_urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-1 mb-3">
                    {log.image_urls.slice(0, 9).map((url, idx) => (
                      <div
                        key={idx}
                        className="aspect-square rounded overflow-hidden bg-forest/5 cursor-pointer"
                        onClick={() => openPreview(log.image_urls, idx)}
                      >
                        <img
                          src={url}
                          alt={`图片 ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* 删除按钮 */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setDeleteTarget(log)}
                    className="text-xs text-secondary hover:text-accent-red transition-colors"
                  >
                    删除
                  </button>
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
                className="text-xs text-red-400 hover:text-red-500 transition-colors"
              >
                {loading ? '加载中...' : '加载更多回忆'}
              </button>
            </div>
          )}
        </>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除日志"
        content="确定要删除这条情侣日志吗？"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 图片预览 */}
      <ImageViewer
        images={previewImages}
        initialIndex={previewIndex}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
