-- ================================================================
-- WorkBuddy V10.0 Supabase Storage 配置
-- 创建图片存储桶和安全策略
-- 执行方式：在 Supabase Dashboard → SQL Editor 中执行
-- ================================================================

-- ============ 创建 Storage 桶 ============
-- 桶名：images
-- 公开读取：false（必须通过签名URL或认证访问）
-- MIME 限制：image/*
-- 文件大小限制：10MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  false,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============ Storage RLS 策略 ============

-- 策略1：用户仅能上传到自己路径下（{user_id}/ 前缀）
-- 防止路径遍历攻击：文件路径必须以用户ID开头
CREATE POLICY "storage_images_upload_own" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 策略2：用户仅能读取自己路径下的文件
CREATE POLICY "storage_images_read_own" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 策略3：用户仅能更新自己路径下的文件
CREATE POLICY "storage_images_update_own" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 策略4：用户仅能删除自己路径下的文件
CREATE POLICY "storage_images_delete_own" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============ 安全说明 ============
-- 1. 所有上传的文件必须存入 {user_id}/{uuid}.webp 路径
-- 2. 文件名使用 UUID 重命名，防止路径遍历和文件名冲突
-- 3. MIME 类型限制为图片格式
-- 4. 文件大小限制为 10MB（前端压缩后应 ≤ 200KB）
-- 5. 非公开桶：必须通过认证才能访问

DO $$
BEGIN
  RAISE NOTICE 'Storage 桶 images 创建完成，4条安全策略已配置';
END;
$$;
