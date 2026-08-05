/**
 * 倒数日列表组件
 * 上半部分：系统自动生成（距离新年、距离下一个节日）
 * 下半部分：用户自定义（Supabase 优先，读取失败回退本地 IndexedDB 缓存）
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { getCachedCountdowns, cacheCountdowns } from '@/lib/countdownCache';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { computeCountdown, daysToNewYear, nextFestival, targetDisplay } from '@/lib/countdown';
import type { Countdown } from '@/types';

// ============ Props ============
interface CountdownListProps {
  onEdit: (c: Countdown) => void;
  onDelete: (c: Countdown) => void;
}

/**
 * 倒数日列表组件
 */
export function CountdownList({ onEdit, onDelete }: CountdownListProps) {
  const [list, setList] = useState<Countdown[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // ============ 数据加载（Supabase 优先 + 本地缓存兜底） ============
  const load = useCallback(async () => {
    let hadCache = false;
    // 1. 先用本地缓存瞬间渲染，避免等海外网络转圈
    try {
      const cached = await getCachedCountdowns();
      if (cached.length > 0) {
        hadCache = true;
        setList(cached);
        setLoading(false); // 立刻显示，不再 spinner
      }
    } catch (cacheErr) {
      console.warn('[CountdownList] 读取本地缓存失败:', cacheErr);
    }

    // 2. 后台去 Supabase 拉最新数据
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;

      try {
        const { data, error } = await supabase
          .from('countdowns')
          .select('*')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const l = (data || []) as Countdown[];
        setList(l);
        try {
          await cacheCountdowns(l);
        } catch (cacheErr) {
          console.warn('[CountdownList] 写入本地缓存失败:', cacheErr);
        }
      } catch (dbErr) {
        console.error('[CountdownList] Supabase 读取失败:', dbErr);
        // 仅当本地也无缓存时才提示错误，否则保留已显示的缓存数据
        if (!hadCache) {
          toast.error('加载失败，请检查网络');
        }
      }
    } catch (e) {
      console.error('[CountdownList] 加载异常:', e);
    } finally {
      setLoading(false);
    }
  }, []); // 故意空依赖：toast 引用每次 render 都新，放进依赖会导致死循环

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在 mount 时加载一次

  if (loading) {
    return <Loading text="加载倒数日中..." />;
  }

  const newYearDays = daysToNewYear();
  const festival = nextFestival();

  // 计算展示天数与文案
  const renderDays = (c: Countdown) => {
    const { days } = computeCountdown(c);
    let label: string;
    if (c.mode === 'since') label = `已 ${days} 天`;
    else if (days >= 0) label = `还剩 ${days} 天`;
    else label = `已过期 ${Math.abs(days)} 天`;
    return { num: Math.abs(days), label };
  };

  return (
    <div className="space-y-6">
      {/* 系统自动生成 */}
      <section>
        <p className="text-xs text-secondary mb-2">系统自动生成</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="bg-forest/5 border-forest/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-forest/10 text-forest">系统</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-forest">{newYearDays}</span>
              <span className="text-sm text-secondary">天</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-ink-dark dark:text-ink-light">距离新年</p>
            <p className="text-xs text-secondary">下一个元旦</p>
          </Card>

          <Card className="bg-forest/5 border-forest/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-forest/10 text-forest">系统</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-forest">{festival.days}</span>
              <span className="text-sm text-secondary">天</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-ink-dark dark:text-ink-light">距离{festival.name}</p>
            <p className="text-xs text-secondary">{festival.date}</p>
          </Card>
        </div>
      </section>

      {/* 我的倒数日 */}
      <section>
        {list.length === 0 ? (
          <EmptyState icon="📅" message="还没有倒数日" description="点击右上角「+ 新增倒数日」开始记录" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {list.map((c) => {
              const { num, label } = renderDays(c);
              return (
                <Card
                  key={c.id}
                  padding="none"
                  className="overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform relative"
                  onClick={() => onEdit(c)}
                >
                  <div className="px-4 py-3" style={c.color ? { borderLeft: `4px solid ${c.color}` } : undefined}>
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-semibold text-ink-dark dark:text-ink-light truncate pr-2">
                        {c.title}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(c);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-secondary hover:bg-accent-red/10 hover:text-accent-red transition-colors flex-shrink-0"
                        aria-label="删除"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold" style={{ color: c.color || '#5A7A4A' }}>
                        {num}
                      </span>
                      <span className="text-sm text-secondary">天</span>
                    </div>
                    <p className="mt-1 text-xs text-secondary">{label}</p>
                    <p className="text-[11px] text-secondary/70 mt-0.5">{targetDisplay(c)}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
