/**
 * 图片上传组件
 * 支持多图选择、压缩为 WebP、魔数校验、上传进度、预览缩略图、删除、每日限制
 */
import { useState, useRef, useCallback } from 'react';
import { compressImage, validateImageMagicNumber, generateUUID } from '@/lib/utils';
import { getAccessToken } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';

// ============ 类型定义 ============
/** 上传状态 */
type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

/** 单个图片项 */
interface ImageItem {
  id: string;                  // 临时ID
  url: string;                 // 上传后URL（完成后赋值）
  thumb: string;               // 本地预览URL
  progress: number;            // 上传进度 0-100
  status: UploadStatus;        // 上传状态
  name: string;                // 原始文件名
}

interface ImageUploaderProps {
  maxCount?: number;           // 最大图片数（默认 9）
  onChange?: (urls: string[]) => void; // 值变化回调
  existingUrls?: string[];      // 已有图片（编辑场景）
}

// 每日上传次数限制
const DAILY_UPLOAD_LIMIT = 30;
const UPLOAD_COUNT_KEY = 'workbuddy-upload-count';

// ============ 辅助函数 ============

/**
 * 获取今日已上传次数
 */
function getTodayUploadCount(): number {
  const today = new Date().toDateString();
  const stored = JSON.parse(localStorage.getItem(UPLOAD_COUNT_KEY) || '{}');
  if (stored.date === today) return stored.count || 0;
  return 0;
}

/**
 * 增加今日上传次数
 */
function incrementUploadCount(): void {
  const today = new Date().toDateString();
  const count = getTodayUploadCount() + 1;
  localStorage.setItem(UPLOAD_COUNT_KEY, JSON.stringify({ date: today, count }));
}

/**
 * 上传单张图片到后端
 */
async function uploadImage(blob: Blob, onProgress: (pct: number) => void): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('未登录');

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', blob, `${generateUUID()}.webp`);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    // 上传进度
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    // 完成回调
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp.success && resp.data?.url) {
            resolve(resp.data.url);
          } else {
            reject(new Error(resp.error || '上传失败'));
          }
        } catch {
          reject(new Error('解析响应失败'));
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.send(formData);
  });
}

/**
 * 图片上传组件
 */
export function ImageUploader({
  maxCount = 9,
  onChange,
  existingUrls = [],
}: ImageUploaderProps) {
  const [images, setImages] = useState<ImageItem[]>(
    existingUrls.map((url) => ({
      id: generateUUID(),
      url,
      thumb: url,
      progress: 100,
      status: 'done',
      name: '',
    })),
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // 通知父组件已完成的 URL 列表
  const notifyChange = useCallback((list: ImageItem[]) => {
    const urls = list.filter((i) => i.status === 'done').map((i) => i.url);
    onChange?.(urls);
  }, [onChange]);

  // 选择文件
  const handleSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 检查数量上限
    const remaining = maxCount - images.length;
    if (remaining <= 0) {
      toast.warning(`最多上传 ${maxCount} 张图片`);
      e.target.value = '';
      return;
    }

    // 检查每日上传限制
    const todayCount = getTodayUploadCount();
    if (todayCount + files.length > DAILY_UPLOAD_LIMIT) {
      toast.error(`今日上传已达上限（${DAILY_UPLOAD_LIMIT} 次）`);
      e.target.value = '';
      return;
    }

    setUploading(true);

    // 处理每个文件
    const newItems: ImageItem[] = [];
    const fileArr = Array.from(files).slice(0, remaining);

    for (const file of fileArr) {
      const itemId = generateUUID();

      // 创建本地预览
      const thumb = URL.createObjectURL(file);
      const newItem: ImageItem = {
        id: itemId,
        url: '',
        thumb,
        progress: 0,
        status: 'pending',
        name: file.name,
      };
      newItems.push(newItem);
      setImages((prev) => [...prev, newItem]);

      try {
        // 1. 魔数校验
        const isValid = await validateImageMagicNumber(file);
        if (!isValid) {
          updateItem(itemId, { status: 'error', progress: 0 });
          toast.error(`文件 ${file.name} 不是有效图片`);
          continue;
        }

        // 2. 压缩为 WebP
        updateItem(itemId, { status: 'uploading' });
        const blob = await compressImage(file);

        // 3. 上传
        const url = await uploadImage(blob, (pct) => {
          updateItem(itemId, { progress: pct });
        });

        // 4. 更新状态
        updateItem(itemId, { status: 'done', url, progress: 100 });
        incrementUploadCount();
      } catch (err: any) {
        updateItem(itemId, { status: 'error' });
        toast.error(`上传失败：${err.message}`);
      }
    }

    // 通知父组件
    setImages((prev) => {
      notifyChange(prev);
      return prev;
    });

    setUploading(false);
    e.target.value = '';
  }, [images, maxCount, toast, notifyChange]);

  // 更新单个图片项
  const updateItem = (id: string, patch: Partial<ImageItem>) => {
    setImages((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      );
      notifyChange(next);
      return next;
    });
  };

  // 删除图片
  const handleRemove = (id: string) => {
    const item = images.find((i) => i.id === id);
    if (item?.thumb.startsWith('blob:')) {
      URL.revokeObjectURL(item.thumb);
    }
    setImages((prev) => {
      const next = prev.filter((i) => i.id !== id);
      notifyChange(next);
      return next;
    });
  };

  // 点击上传按钮
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      {/* 九宫格预览 */}
      <div className="grid grid-cols-3 gap-2">
        {images.map((item) => (
          <div
            key={item.id}
            className="relative aspect-square rounded-lg overflow-hidden bg-forest/5 border border-forest/15"
          >
            {/* 缩略图 */}
            <img
              src={item.thumb}
              alt={item.name}
              className="w-full h-full object-cover"
            />
            {/* 上传进度条 */}
            {item.status === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="w-3/4">
                  <div className="h-1.5 rounded-full bg-cream/30">
                    <div
                      className="h-full rounded-full bg-forest-light transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-cream mt-1">{item.progress}%</p>
                </div>
              </div>
            )}
            {/* 错误状态 */}
            {item.status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-accent-red/70">
                <span className="text-cream text-xs">上传失败</span>
              </div>
            )}
            {/* 删除按钮 */}
            {item.status !== 'uploading' && (
              <button
                onClick={() => handleRemove(item.id)}
                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/50 text-cream text-xs hover:bg-black/70 transition-colors"
                aria-label="删除"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {/* 上传按钮 */}
        {images.length < maxCount && (
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className="aspect-square rounded-lg border-2 border-dashed border-forest/30 flex flex-col items-center justify-center text-secondary hover:border-forest hover:bg-forest/5 transition-all min-h-[44px]"
          >
            <span className="text-2xl">📷</span>
            <span className="text-xs mt-1">{uploading ? '上传中' : '添加'}</span>
          </button>
        )}
      </div>

      {/* 隐藏文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      {/* 底部提示 */}
      <div className="mt-2 flex items-center justify-between text-xs text-secondary">
        <span>{images.length}/{maxCount} 张</span>
        <span>今日已上传 {getTodayUploadCount()}/{DAILY_UPLOAD_LIMIT} 次</span>
      </div>
    </div>
  );
}
