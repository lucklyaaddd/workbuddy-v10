/**
 * 菜谱详情弹窗
 * 展示图片、食材清单、制作步骤
 * 底部提供「编辑」「删除」操作，删除需二次确认
 */
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { deleteCachedRecipe } from '@/lib/recipeCache';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Recipe } from '@/types';

// ============ Props ============
interface RecipeDetailProps {
  recipe: Recipe | null;     // 当前查看的菜谱（null 不渲染）
  onClose: () => void;       // 关闭详情
  onEdit: (recipe: Recipe) => void; // 触发编辑
  onDeleted: () => void;     // 删除成功后通知父组件刷新
}

/**
 * 菜谱详情组件
 */
export function RecipeDetail({ recipe, onClose, onEdit, onDeleted }: RecipeDetailProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  // recipe 为 null 时不渲染（hooks 之后判断，符合规则）
  if (!recipe) return null;

  // ============ 删除（软删除 + 清理本地缓存） ============
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('recipes')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', recipe.id);

      if (error) throw error;

      // 同步清理本地缓存
      await deleteCachedRecipe(recipe.id);

      toast.success('已删除');
      setConfirmOpen(false);
      onClose();
      onDeleted();
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  // 步骤按 order 排序
  const steps = [...(recipe.steps || [])].sort((a, b) => a.order - b.order);

  return (
    <>
      <Modal
        open={!!recipe}
        onClose={onClose}
        title={recipe.name}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => onEdit(recipe)}>
              ✏️ 编辑
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => setConfirmOpen(true)}
              loading={deleting}
            >
              🗑 删除
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* 图片 */}
          {recipe.image_data && (
            <div className="rounded-xl overflow-hidden bg-forest/5">
              <img
                src={recipe.image_data}
                alt={recipe.name}
                className="w-full max-h-[40vh] object-contain"
              />
            </div>
          )}

          {/* 食材清单 */}
          <div>
            <h4 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-2 flex items-center gap-1">
              🧺 食材清单
            </h4>
            {recipe.ingredients.length === 0 ? (
              <p className="text-xs text-secondary">暂无食材记录</p>
            ) : (
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm bg-forest/5 rounded-lg px-3 py-2"
                  >
                    <span className="text-ink-dark dark:text-ink-light">{ing.name}</span>
                    <span className="text-secondary font-medium">{ing.amount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 制作步骤 */}
          <div>
            <h4 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-2 flex items-center gap-1">
              👩‍🍳 制作步骤
            </h4>
            {steps.length === 0 ? (
              <p className="text-xs text-secondary">暂无步骤记录</p>
            ) : (
              <ol className="space-y-2.5">
                {steps.map((step) => (
                  <li key={step.order} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-forest text-cream text-xs flex items-center justify-center font-semibold">
                      {step.order}
                    </span>
                    <p className="text-sm text-ink-dark dark:text-ink-light leading-relaxed pt-0.5">
                      {step.description}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </Modal>

      {/* 删除二次确认 */}
      <ConfirmDialog
        open={confirmOpen}
        title="删除菜谱"
        content={`确定删除「${recipe.name}」吗？此操作不可恢复。`}
        confirmText="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
