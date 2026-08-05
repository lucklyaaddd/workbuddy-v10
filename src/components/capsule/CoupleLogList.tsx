/**
 * 情侣日志列表组件
 * 红粉色调主题
 * 功能：卡片展示、心情标签筛选、日历视图、收藏切换、图片九宫格预览、在一起天数、纪念日倒计时
 * 本地优先：先用 IndexedDB 缓存秒开，再后台从 Supabase 刷新
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { createLocalStore } from '@/lib/localDb';
import { escapeHtml, formatRelativeTime } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ImageViewer } from '@/components/common/ImageViewer';
import { TogetherDateForm } from '@/components/capsule/TogetherDateForm';
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

/** 缓存 */
const logStore = createLocalStore<CoupleLog>('workbuddy-couple-logs');

/**
 * 情侣日志列表组件
 */
export function CoupleLogList() {
  const [logs, setLogs] = useState<CoupleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [moodFilter, setMoodFilter] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CoupleLog | null>(null);
  // "在一起纪念日"：来自 user_preferences.together_since（YYYY-MM-DD）；null = 未设置
  const [togetherSince, setTogetherSince] = useState<string | null>(null);
  const [togetherFormOpen, setTogetherFormOpen] = useState(false);
  // 图片预览
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const toast = useToast();

  // ============ 数据加载（本地优先） ============

  const loadTogetherSince = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('together_since')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      setTogetherSince(data?.together_since ?? null);
    } catch (e) {
      console.warn('[CoupleLogList] 读取在一起日期失败:', e);
      // 失败时保持 null，不显示卡片（避免误用日志日期算出 0 天）
    }
  }, []);

  const loadLogs = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    // 1. 本地缓存秒开
    try {
      const cached = await logStore.getCached();
      if (cached.length > 0) {
        setLogs(cached);
        setLoading(false);
      }
    } catch {
      /* 忽略 */
    }

    // 2. 后台刷新（一次性取回全部，排序/筛选/分页均在前端完成）
    try {
      const { data, error } = await supabase
        .from('couple_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list = (data || []) as CoupleLog[];
      setLogs(list);
      await logStore.setCached(list);
    } catch (e) {
      console.error('[CoupleLogList] 加载失败:', e);
      if (logs.length === 0) toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [toast, logs.length]);

  useEffect(() => {
    loadLogs();
    loadTogetherSince();
    // 仅挂载加载一次；心情/收藏均为前端筛选
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 每次本地数据变化都回写缓存 */
  useEffect(() => {
    if (logs.length > 0) logStore.setCached(logs);
  }, [logs]);

  const loadMore = () => setVisibleCount((c) => c + PAGE_SIZE);

  // ============ 前端筛选 ============
  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (moodFilter && l.mood !== moodFilter) return false;
      if (starredOnly && !l.is_starred) return false;
      return true;
    });
  }, [logs, moodFilter, starredOnly]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  // ============ 在一起天数 ============
  // 数据源：用户偏好（user_preferences.together_since）。仅在用户主动设置后才显示——
  // 不要再用"最早的日志日期"代替，避免"今天记第一条就显示 0 天"。

  const togetherDays = useMemo(() => {
    if (!togetherSince) return null;
    const start = new Date(togetherSince);
    if (isNaN(start.getTime())) return null;
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [togetherSince]);

  // ============ 日历标记日期 ============

  const markedDates = useMemo(() => {
    return new Set(filtered.map((l) => l.log_date));
  }, [filtered]);

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
      {/* 在一起天数 / 设置入口 */}
      {togetherDays !== null ? (
        <Card padding="md" className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between gap-3">
            <p className="flex-1 text-sm text-red-500 dark:text-red-400 font-medium">
              💞 已经在一起 {togetherDays} 天啦
            </p>
            <button
              onClick={() => setTogetherFormOpen(true)}
              className="px-2.5 py-1 rounded-md text-xs text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              aria-label="修改在一起纪念日"
            >
              ✏️ 改
            </button>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setTogetherFormOpen(true)}
          className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-red-300 dark:border-red-700 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
        >
          📅 设置在一起纪念日（顶部会显示"已经在一起 N 天啦"）
        </button>
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
      {filtered.length === 0 ? (
        <EmptyState
          icon="💞"
          message="还没有记录，写下属于你们的第一个回忆吧 💞"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((log) => (
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
                className="text-xs text-red-400 hover:text-red-500 transition-colors"
              >
                加载更多回忆
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

      {/* 设置/修改 在一起纪念日 */}
      <TogetherDateForm
        open={togetherFormOpen}
        currentValue={togetherSince}
        onClose={() => setTogetherFormOpen(false)}
        onSaved={(val) => setTogetherSince(val)}
      />
    </div>
  );
}
