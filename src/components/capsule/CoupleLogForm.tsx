/**
 * 情侣日志新增/编辑表单组件
 * 功能：内容、心情标签选择、日期、多图上传
 */
import { useState, useEffect } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { today } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ImageUploader } from '@/components/common/ImageUploader';
import type { CoupleLog } from '@/types';

// ============ 类型定义 ============
interface CoupleLogFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editLog?: CoupleLog | null;
  /** 画板生成的图片URL（外部注入） */
  drawingImage?: string | null;
  onClearDrawing?: () => void;
}

/** 心情标签选项 */
const MOOD_OPTIONS = ['开心', '感动', '甜蜜', '想念', '日常', '期待'];
const MOOD_EMOJIS: Record<string, string> = {
  '开心': '😊', '感动': '🥹', '甜蜜': '🍯',
  '想念': '💭', '日常': '📝', '期待': '🌟',
};

/**
 * 情侣日志表单组件
 */
export function CoupleLogForm({
  open, onClose, onSaved, editLog,
  drawingImage, onClearDrawing,
}: CoupleLogFormProps) {
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [logDate, setLogDate] = useState(today());
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  // ============ 初始化 ============
  useEffect(() => {
    if (open) {
      if (editLog) {
        setContent(editLog.content);
        setMood(editLog.mood || '');
        setLogDate(editLog.log_date);
        setImageUrls(editLog.image_urls || []);
      } else {
        setContent('');
        setMood('');
        setLogDate(today());
        setImageUrls([]);
      }
      setErrors({});
    }
  }, [open, editLog]);

  // ============ 接收画板生成的图片 ============
  useEffect(() => {
    if (drawingImage && !imageUrls.includes(drawingImage)) {
      setImageUrls((prev) => [...prev, drawingImage]);
      onClearDrawing?.();
    }
  }, [drawingImage]);

  // ============ 验证 ============
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!content.trim()) {
      newErrors.content = '请输入内容';
    }
    if (!logDate) {
      newErrors.date = '请选择日期';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

    const payload = {
      content: content.trim(),
      mood: mood || null,
      log_date: logDate,
      image_urls: imageUrls,
      user_id: userId,
    };

    try {
      if (editLog) {
        const { error } = await supabase
          .from('couple_logs')
          .update(payload)
          .eq('id', editLog.id);

        if (error) throw error;
        toast.success('日志已更新');
      } else {
        const { error } = await supabase.from('couple_logs').insert(payload);
        if (error) throw error;
        toast.success('回忆已记录 💞');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // ============ 渲染 ============
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editLog ? '编辑日志' : '记录这一刻'}
      maxWidth="520px"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            loading={saving}
          >
            {editLog ? '保存' : '记录'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 内容 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">
            内容 *
          </label>
          <textarea
            className={[
              'w-full rounded-lg border-2 px-3 py-2.5 text-sm outline-none transition-colors resize-none',
              'bg-cream dark:bg-forest-dark text-ink-dark dark:text-ink-light',
              'min-h-[100px]',
              errors.content ? 'border-accent-red' : 'border-forest/20 focus:border-forest-light',
            ].join(' ')}
            placeholder="今天发生了什么？"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoFocus
          />
          {errors.content && <p className="mt-1 text-xs text-accent-red">{errors.content}</p>}
        </div>

        {/* 心情标签选择 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-2">
            心情（可选）
          </label>
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setMood(mood === m ? '' : m)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                  'active:scale-95 gpu-accelerated',
                  mood === m
                    ? 'bg-red-500 text-cream border-red-500'
                    : 'bg-cream dark:bg-forest-dark/50 text-secondary border-red-200 dark:border-red-800',
                ].join(' ')}
              >
                {MOOD_EMOJIS[m] || ''} {m}
              </button>
            ))}
          </div>
        </div>

        {/* 日期 */}
        <Input
          label="日期"
          type="date"
          value={logDate}
          onChange={(e) => setLogDate(e.target.value)}
          error={errors.date}
        />

        {/* 多图上传 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">
            图片（可选）
          </label>
          <ImageUploader
            maxCount={9}
            existingUrls={imageUrls}
            onChange={setImageUrls}
          />
        </div>
      </div>
    </Modal>
  );
}
