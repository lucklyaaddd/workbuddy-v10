/**
 * 菜谱新增/编辑表单
 * 字段：菜品名称、图片（本地选择+压缩后直传 Supabase Storage）、食材（多条可增删）、步骤（多条可排序）
 *
 * 图片改为「对象存储外链」方案：
 *  - 浏览器把压缩后的图片二进制直接上传到 Supabase Storage（recipe-images 桶）
 *  - 数据库 recipes.image_data 只存一个公开 URL 字符串
 *  - 上传更快（不再把巨大 base64 塞进数据库行），也不吃数据库行额度
 */
import { useState, useEffect } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { putCachedRecipe } from '@/lib/recipeCache';
import { uploadRecipeImage } from '@/lib/recipeStorage';
import { useToast } from '@/hooks/useToast';
import { compressImage, validateImageMagicNumber, generateUUID } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Recipe, Ingredient, RecipeStep } from '@/types';

// ============ Props ============
interface RecipeFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editRecipe?: Recipe | null;
}

// 步骤本地中间态（保存时映射为带 order 的 RecipeStep[]）
interface StepDraft {
  id: string;
  description: string;
}

/**
 * 菜谱表单组件
 */
export function RecipeForm({ open, onClose, onSaved, editRecipe }: RecipeFormProps) {
  const [name, setName] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // 压缩后本地预览（object URL），上传完成后让位给最终 URL
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  // ============ 初始化表单 ============
  useEffect(() => {
    if (!open) return;
    if (editRecipe) {
      setName(editRecipe.name);
      setImageData(editRecipe.image_data || null);
      setPreviewUrl(null);
      setIngredients(
        editRecipe.ingredients?.length
          ? editRecipe.ingredients.map((i) => ({ ...i }))
          : [{ name: '', amount: '' }],
      );
      setSteps(
        editRecipe.steps?.length
          ? editRecipe.steps.map((s) => ({ id: generateUUID(), description: s.description }))
          : [{ id: generateUUID(), description: '' }],
      );
    } else {
      setName('');
      setImageData(null);
      setPreviewUrl(null);
      setIngredients([{ name: '', amount: '' }]);
      setSteps([{ id: generateUUID(), description: '' }]);
    }
    setErrors({});
  }, [open, editRecipe]);

  // ============ 图片选择 + 压缩 + 直传 Storage ============
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const ok = await validateImageMagicNumber(file);
      if (!ok) {
        toast.error('请选择有效的图片文件');
        return;
      }
      setImgLoading(true);
      const blob = await compressImage(file);

      // 本地即时预览（object URL，无需等网络）
      const objUrl = URL.createObjectURL(blob);
      setPreviewUrl(objUrl);

      // 直传 Supabase Storage，拿回公开 URL
      const userId = await getCurrentUserId();
      if (!userId) {
        toast.error('请先登录');
        URL.revokeObjectURL(objUrl);
        setPreviewUrl(null);
        return;
      }
      const url = await uploadRecipeImage(blob, file.type, userId);
      setImageData(url);
      // 上传完成，用最终 URL 替换本地预览
      URL.revokeObjectURL(objUrl);
      setPreviewUrl(null);
    } catch (err: any) {
      // 上传失败：清掉预览，避免误导（保存时不会带图）
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      toast.error(err?.message || '图片上传失败');
    } finally {
      setImgLoading(false);
    }
  };

  // ============ 食材操作 ============
  const updateIngredient = (idx: number, patch: Partial<Ingredient>) => {
    setIngredients((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addIngredient = () => setIngredients((prev) => [...prev, { name: '', amount: '' }]);
  const removeIngredient = (idx: number) =>
    setIngredients((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  // ============ 步骤操作 ============
  const updateStep = (idx: number, description: string) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, description } : s)));
  };
  const addStep = () => setSteps((prev) => [...prev, { id: generateUUID(), description: '' }]);
  const removeStep = (idx: number) =>
    setSteps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // ============ 验证 ============
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = '请输入菜品名称';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ============ 保存 ============
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const userId = await getCurrentUserId();
    if (!userId) {
      toast.error('请先登录');
      setSaving(false);
      return;
    }
    console.log('[RecipeForm.save] debug:', {
      userId,
      editRecipeId: editRecipe?.id,
      editRecipeUserId: editRecipe?.user_id,
      editRecipeVersion: editRecipe?.version,
    });

    const cleanIngredients = ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name.trim(), amount: i.amount.trim() }));

    const cleanSteps: RecipeStep[] = steps
      .filter((s) => s.description.trim())
      .map((s, i) => ({ order: i + 1, description: s.description.trim() }));

    // 编辑时不带 user_id：不显式重写该列，PostgreSQL 不会触发 RLS WITH CHECK 对它的重新评估
    const basePayload = {
      name: name.trim(),
      image_data: imageData,
      ingredients: cleanIngredients,
      steps: cleanSteps,
      updated_at: new Date().toISOString(),
      version: (editRecipe?.version || 0) + 1,
    };
    const insertPayload = { ...basePayload, user_id: userId };

    try {
      let saved: Recipe;
      if (editRecipe) {
        const { error } = await supabase
          .from('recipes')
          .update(basePayload)
          .eq('id', editRecipe.id);
        if (error) throw error;
        saved = { ...editRecipe, ...basePayload };
      } else {
        const { data, error } = await supabase
          .from('recipes')
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw error;
        saved = data as Recipe;
      }

      // 写入本地缓存
      await putCachedRecipe(saved);
      toast.success(editRecipe ? '已更新' : '已保存');
      onSaved();
      onClose();
    } catch (err: any) {
      // 完整透出 Supabase 错误（含 PostgreSQL hint），方便定位是 400/42501 还是别的问题
      console.error('[RecipeForm.save] error:', err);
      const code = err?.code ? `[${err.code}] ` : '';
      const hint = err?.hint ? `  hint: ${err.hint}` : '';
      const details = err?.details ? `  details: ${err.details}` : '';
      toast.error(`${code}${err?.message || '保存失败'}${hint}${details}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editRecipe ? '编辑菜谱' : '新增菜谱'}
      maxWidth="560px"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* 菜品名称 */}
        <Input
          label="菜品名称 *"
          placeholder="如：番茄炒蛋"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        {/* 图片上传 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">
            菜品图片
          </label>
          <div className="flex items-center gap-3">
            {/* 预览框 */}
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-forest/5 border border-forest/15 flex items-center justify-center text-2xl flex-shrink-0">
              {imgLoading ? (
                <span className="w-5 h-5 border-2 border-forest border-t-transparent rounded-full animate-spin" />
              ) : (imageData || previewUrl) ? (
                <img src={imageData || previewUrl || ''} className="w-full h-full object-cover" alt="预览" />
              ) : (
                '🍲'
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                <span className="inline-flex items-center justify-center px-4 py-2 rounded-lg border-2 border-forest text-forest text-sm font-semibold min-h-[44px] hover:bg-forest/10 active:scale-95 transition-all">
                  {imageData ? '重新选择' : '选择图片'}
                </span>
              </label>
              {(imageData || previewUrl) && (
                <button
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setImageData(null);
                    setPreviewUrl(null);
                  }}
                  className="text-xs text-accent-red hover:underline self-start"
                >
                  移除图片
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-secondary mt-1">图片自动压缩后上传到云存储，数据库只存链接，上传更快、不占额度</p>
        </div>

        {/* 食材清单 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-ink-dark dark:text-ink-light">食材清单</label>
            <button onClick={addIngredient} className="text-xs text-forest hover:underline">
              + 添加食材
            </button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input
                  placeholder="食材名"
                  value={ing.name}
                  onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="用量"
                  value={ing.amount}
                  onChange={(e) => updateIngredient(idx, { amount: e.target.value })}
                  className="w-24"
                />
                <button
                  onClick={() => removeIngredient(idx)}
                  disabled={ingredients.length === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-secondary hover:bg-forest/10 disabled:opacity-30 transition-colors"
                  aria-label="删除食材"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 制作步骤 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-ink-dark dark:text-ink-light">制作步骤</label>
            <button onClick={addStep} className="text-xs text-forest hover:underline">
              + 添加步骤
            </button>
          </div>
          <div className="space-y-2">
            {steps.map((s, idx) => (
              <div key={s.id} className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-6 h-9 flex items-center justify-center rounded-full bg-forest text-cream text-xs font-semibold">
                  {idx + 1}
                </span>
                <textarea
                  className="flex-1 rounded-lg border-2 border-forest/20 px-3 py-2 text-sm outline-none focus:border-forest-light bg-cream dark:bg-forest-dark text-ink-dark dark:text-ink-light min-h-[44px] resize-none"
                  placeholder={`第 ${idx + 1} 步...`}
                  value={s.description}
                  onChange={(e) => updateStep(idx, e.target.value)}
                />
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveStep(idx, -1)}
                    disabled={idx === 0}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-secondary hover:bg-forest/10 disabled:opacity-30 transition-colors"
                    aria-label="上移"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveStep(idx, 1)}
                    disabled={idx === steps.length - 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-secondary hover:bg-forest/10 disabled:opacity-30 transition-colors"
                    aria-label="下移"
                  >
                    ↓
                  </button>
                </div>
                <button
                  onClick={() => removeStep(idx)}
                  disabled={steps.length === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-secondary hover:bg-forest/10 disabled:opacity-30 transition-colors"
                  aria-label="删除步骤"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
