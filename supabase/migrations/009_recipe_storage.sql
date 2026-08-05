-- ================================================================
-- WorkBuddy V10.0 菜谱图片存储桶
-- 把菜谱图片从「base64 存数据库行」改为「Supabase Storage 对象存储」
-- 数据库只存图片公开 URL，上传更快、不占数据库行额度
-- 执行方式：Supabase Dashboard → SQL Editor 中执行本文件全部内容
-- ================================================================

-- ============ 1. 创建公开存储桶 recipe-images ============
-- public=true：图片 URL 可直接在 <img> 中访问，无需签名
-- file_size_limit=5MB：单文件上限，够菜谱缩略图用
-- allowed_mime_types：仅允许图片类型
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[];

-- ============ 2. storage.objects RLS 策略 ============
-- 仅允许已登录用户操作「自己 userId 前缀目录」下的对象
-- 路径约定：{user_id}/{uuid}.{ext}  → foldername(name)[1] 即 user_id

-- 上传
DROP POLICY IF EXISTS "recipe_images_insert" ON storage.objects;
CREATE POLICY "recipe_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 更新（覆盖/重传）
DROP POLICY IF EXISTS "recipe_images_update" ON storage.objects;
CREATE POLICY "recipe_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 删除
DROP POLICY IF EXISTS "recipe_images_delete" ON storage.objects;
CREATE POLICY "recipe_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 公开读：bucket 已 public=true，匿名即可访问 URL，无需额外 SELECT 策略

DO $$
BEGIN
  RAISE NOTICE 'recipe-images 存储桶已创建，storage RLS 3 条策略已配置';
END;
$$;
