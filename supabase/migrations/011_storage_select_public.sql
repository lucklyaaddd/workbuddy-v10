-- ================================================================
-- WorkBuddy V10.0 Storage 公共桶 SELECT 策略（兜底）
-- 现象：菜谱图片 GET 浏览器报 400
-- 根因：Supabase Storage 公共桶（public=true）允许 anon GET，
--       但偶发环境下仍要求显式 SELECT 策略，否则响应 400
-- 修复：加一条 SELECT 策略允许 anon 读 recipe-images 桶
--       INSERT/UPDATE/DELETE 仍由 009 控制（仅自己 userId 目录）
-- ================================================================

DROP POLICY IF EXISTS "recipe_images_select" ON storage.objects;
CREATE POLICY "recipe_images_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'recipe-images');

DO $$
BEGIN
  RAISE NOTICE 'recipe-images 公共 SELECT 策略已建立（anon 可直接 GET 公开 URL）';
END;
$$;
