/**
 * 私厨菜谱页面
 * 整合 RecipeList + RecipeDetail + RecipeForm
 */
import { useState, useCallback } from 'react';
import { RecipeList } from '@/components/recipes/RecipeList';
import { RecipeDetail } from '@/components/recipes/RecipeDetail';
import { RecipeForm } from '@/components/recipes/RecipeForm';
import { Button } from '@/components/ui/Button';
import type { Recipe } from '@/types';

export default function Recipes() {
  const [formOpen, setFormOpen] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleAdd = () => {
    setEditRecipe(null);
    setFormOpen(true);
  };

  const handleEdit = (recipe: Recipe) => {
    setEditRecipe(recipe);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* 页面标题 + 新增按钮 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-dark dark:text-ink-light">私厨菜谱</h2>
        <Button
          variant="primary"
          size="lg"
          onClick={handleAdd}
          className="rounded-full px-5"
        >
          ＋ 新增菜谱
        </Button>
      </div>

      {/* 菜谱列表 */}
      <RecipeList key={refreshKey} onOpen={setDetailRecipe} onEdit={handleEdit} />

      {/* 详情弹窗 */}
      <RecipeDetail
        recipe={detailRecipe}
        onClose={() => setDetailRecipe(null)}
        onEdit={(r) => {
          setDetailRecipe(null);
          handleEdit(r);
        }}
        onDeleted={handleSaved}
      />

      {/* 新增/编辑表单 */}
      <RecipeForm
        open={formOpen}
        editRecipe={editRecipe}
        onClose={() => {
          setFormOpen(false);
          setEditRecipe(null);
        }}
        onSaved={handleSaved}
      />
    </div>
  );
}
