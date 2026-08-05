/**
 * 菜谱列表组件
 * 网格卡片展示：缩略图 + 菜品名称，点击卡片打开详情
 * 数据：Supabase 优先，读取失败回退本地 IndexedDB 缓存（离线兜底）
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { getCachedRecipes, cacheRecipes } from '@/lib/recipeCache';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Recipe } from '@/types';

// ============ Props ============
interface RecipeListProps {
  onOpen: (recipe: Recipe) => void;  // 打开详情
  onEdit: (recipe: Recipe) => void;  // 触发编辑
}

/**
 * 菜谱列表组件
 */
export function RecipeList({ onOpen, onEdit }: RecipeListProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // ============ 数据加载（Supabase 优先 + 本地缓存兜底） ============
  const loadRecipes = useCallback(async () => {
    setLoading(true);
    const userId = await getCurrentUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list = (data || []) as Recipe[];
      setRecipes(list);
      // 成功后将数据写入本地缓存，供离线时兜底
      await cacheRecipes(list);
    } catch (e) {
      // Supabase 读取失败 → 回退本地缓存
      const cached = await getCachedRecipes();
      if (cached.length > 0) {
        setRecipes(cached);
        toast.info('离线模式：显示本地缓存的菜谱');
      } else {
        toast.error('加载失败，请检查网络');
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  if (loading) {
    return <Loading text="加载菜谱中..." />;
  }

  if (recipes.length === 0) {
    return (
      <EmptyState
        icon="🍲"
        message="还没有菜谱，记录你的第一道私房菜吧"
        description="点击右上角「+ 新增菜谱」开始"
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {recipes.map((recipe) => (
        <Card
          key={recipe.id}
          padding="none"
          className="overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform"
          onClick={() => onOpen(recipe)}
        >
          {/* 缩略图 */}
          <div className="aspect-square w-full bg-forest/5 relative overflow-hidden">
            {recipe.image_data ? (
              <img
                src={recipe.image_data}
                alt={recipe.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🍲</div>
            )}
          </div>

          {/* 名称 + 概要 */}
          <div className="px-3 py-2.5">
            <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light truncate">
              {recipe.name}
            </h3>
            <p className="text-xs text-secondary mt-0.5">
              {recipe.ingredients.length} 种食材 · {recipe.steps.length} 步
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
