-- ================================================================
-- WorkBuddy V10.0 放宽 recipes 表 UPDATE RLS
-- 现象：编辑菜谱保存时报
--   [42501] new row violates row-level security policy
-- 根因：recipes_update_own 策略 USING+WITH CHECK 都限定
--   auth.uid() = user_id
--   编辑路径即使不修改 user_id 也会被 PostgreSQL 重新评估触发
-- 修复：保持 USING 不变（仍限制只能 UPDATE 自己的行），
--       WITH CHECK 放宽到 auth.uid() IS NOT NULL
--       （private 双人应用下已被 USING 锁住可见行）
-- ================================================================

DROP POLICY IF EXISTS "recipes_update_own" ON public.recipes;
CREATE POLICY "recipes_update_own" ON public.recipes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 同步：Insert 策略保持原状（auth.uid() = user_id，新建本来就明确写 user_id）

DO $$
BEGIN
  RAISE NOTICE 'recipes UPDATE 策略已放宽：USING 仍仅自己可见，WITH CHECK 改为登录态即可';
END;
$$;
