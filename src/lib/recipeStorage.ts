/**
 * 菜谱图片上传到 Supabase Storage（对象存储）
 * 直接传压缩后的二进制 Blob，不经过 base64，上传更快、不占数据库行额度
 * 数据库 recipes.image_data 仅存返回的公开 URL 字符串
 */
import { supabase } from '@/lib/supabase';
import { generateUUID } from '@/lib/utils';

const BUCKET = 'recipe-images';

/**
 * 上传一张菜谱图片
 * @param blob  压缩后的图片 Blob
 * @param mime  原文件 MIME（如 image/jpeg）
 * @param userId 当前用户 ID，用作存储目录前缀（RLS 限制只能写自己的目录）
 * @returns 公开可访问的图片 URL
 */
export async function uploadRecipeImage(blob: Blob, mime: string, userId: string): Promise<string> {
  const rawExt = (mime.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '');
  const ext = rawExt || 'jpg';
  const path = `${userId}/${generateUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: mime,
      upsert: true,
      cacheControl: '3600',
    });

  if (error) {
    throw new Error(error.message || '图片上传失败');
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/**
 * 删除一张菜谱图片（软删除菜谱时调用，避免存储桶堆积孤儿文件）
 * @param url 之前保存的公开 URL；无法解析时静默忽略
 */
export async function deleteRecipeImage(url: string | null | undefined): Promise<void> {
  if (!url || !url.includes(`/object/public/${BUCKET}/`)) return;
  try {
    const marker = `/object/public/${BUCKET}/`;
    const path = url.substring(url.indexOf(marker) + marker.length);
    if (!path) return;
    await supabase.storage.from(BUCKET).remove([path]);
  } catch (e) {
    console.warn('[recipeStorage] 删除图片失败（已忽略）:', e);
  }
}
