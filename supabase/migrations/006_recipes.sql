-- ================================================================
-- WorkBuddy V10.0 私厨菜谱模块
-- 创建 recipes 表 + RLS 策略 + 权限授权
-- 执行方式：Supabase Dashboard → SQL Editor 中执行本文件全部内容
-- ================================================================

-- ============ 创建 recipes 表 ============
CREATE TABLE IF NOT EXISTS public.recipes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  image_data   text,                                   -- 菜品图片（压缩后的 base64 dataURL）
  ingredients  jsonb       NOT NULL DEFAULT '[]'::jsonb, -- 食材清单 [{name, amount}]
  steps        jsonb       NOT NULL DEFAULT '[]'::jsonb, -- 制作步骤 [{order, description}]
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  is_deleted   boolean     NOT NULL DEFAULT false,      -- 软删除标记
  version      integer     NOT NULL DEFAULT 1           -- 乐观锁版本号
);

-- ============ 索引 ============
CREATE INDEX IF NOT EXISTS idx_recipes_user_created
  ON public.recipes (user_id, created_at DESC);

-- ============ 开启行级安全 RLS ============
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- ============ RLS 策略（用户仅能操作自己的菜谱） ============
DROP POLICY IF EXISTS "recipes_select_own" ON public.recipes;
CREATE POLICY "recipes_select_own" ON public.recipes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "recipes_insert_own" ON public.recipes;
CREATE POLICY "recipes_insert_own" ON public.recipes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recipes_update_own" ON public.recipes;
CREATE POLICY "recipes_update_own" ON public.recipes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recipes_delete_own" ON public.recipes;
CREATE POLICY "recipes_delete_own" ON public.recipes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ 权限授权（关键：否则前端报 42501 permission denied） ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL PRIVILEGES ON public.recipes TO service_role;

DO $$
BEGIN
  RAISE NOTICE 'recipes 表创建完成，RLS 4 条策略已配置，权限已授权';
END;
$$;
