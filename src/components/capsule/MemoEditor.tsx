/**
 * 备忘录编辑器组件
 * 功能：标题、内容、分类、标签、置顶、多图上传、提醒、导出 TXT/Markdown、唤起画板
 */
import { useState, useEffect } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { escapeHtml, today } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUploader } from '@/components/common/ImageUploader';
import type { Memo } from '@/types';

// ============ 类型定义 ============
interface MemoEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editMemo?: Memo | null;
  /** 画板生成图片 */
  drawingImage?: string | null;
  onClearDrawing?: () => void;
  /** 唤起画板回调 */
  onOpenDrawingBoard?: () => void;
}

/** 分类选项 */
const CATEGORY_OPTIONS = [
  { value: '', label: '请选择分类' },
  { value: '默认', label: '默认' },
  { value: '工作', label: '工作' },
  { value: '学习', label: '学习' },
  { value: '生活', label: '生活' },
  { value: '其他', label: '其他' },
];

/**
 * 备忘录编辑器组件
 */
export function MemoEditor({
  open, onClose, onSaved, editMemo,
  drawingImage, onClearDrawing,
  onOpenDrawingBoard,
}: MemoEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  // ============ 初始化 ============
  useEffect(() => {
    if (open) {
      if (editMemo) {
        setTitle(editMemo.title || '');
        setContent(editMemo.content || '');
        setCategory(editMemo.category || '');
        setTags((editMemo.tags || []).join(', '));
        setIsPinned(editMemo.is_pinned);
        setImageUrls(editMemo.image_urls || []);
      } else {
        setTitle('');
        setContent('');
        setCategory('');
        setTags('');
        setIsPinned(false);
        setImageUrls([]);
      }
      setErrors({});
    }
  }, [open, editMemo]);

  // ============ 接收画板图片 ============
  useEffect(() => {
    if (drawingImage && !imageUrls.includes(drawingImage)) {
      setImageUrls((prev) => [...prev, drawingImage]);
      onClearDrawing?.();
    }
  }, [drawingImage]);

  // ============ 验证 ============
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = '请输入标题';
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

    // 解析标签：逗号分隔
    const tagList = tags.split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      content: content.trim(),
      category: category || null,
      is_pinned: isPinned,
      tags: tagList,
      image_urls: imageUrls,
      user_id: userId,
    };

    try {
      if (editMemo) {
        const { error } = await supabase
          .from('memos')
          .update(payload)
          .eq('id', editMemo.id);

        if (error) throw error;
        toast.success('备忘录已更新');
      } else {
        const { error } = await supabase.from('memos').insert(payload);
        if (error) throw error;
        toast.success('备忘录已创建');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // ============ 导出 ============

  /** 导出 TXT */
  const handleExportTxt = () => {
    if (!content.trim()) {
      toast.warning('没有可导出的内容');
      return;
    }
    const text = `${title}\n\n${content}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${title || '备忘录'}.txt`);
  };

  /** 导出 Markdown */
  const handleExportMarkdown = () => {
    if (!content.trim() && !title.trim()) {
      toast.warning('没有可导出的内容');
      return;
    }
    const tagMd = tags.split(',').filter(Boolean).map((t) => `#${t.trim()}`).join(' ');
    const md = `# ${title}\n\n${content}\n\n---\n${tagMd}`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `${title || '备忘录'}.md`);
  };

  /** 下载 Blob */
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${filename}`);
  };

  // ============ 渲染 ============
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editMemo ? '编辑备忘录' : '新建备忘录'}
      maxWidth="600px"
      footer={
        <div className="flex items-center gap-3 w-full justify-between">
          {/* 左侧：导出按钮 */}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleExportTxt}>
              TXT
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportMarkdown}>
              MD
            </Button>
            {onOpenDrawingBoard && (
              <Button variant="ghost" size="sm" onClick={onOpenDrawingBoard}>
                ✏️ 画板
              </Button>
            )}
          </div>
          {/* 右侧：取消/保存 */}
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={onClose}>
              取消
            </Button>
            <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
              {editMemo ? '保存' : '创建'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 标题 */}
        <Input
          label="标题 *"
          placeholder="备忘录标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          autoFocus
        />

        {/* 内容 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">
            内容（可选）
          </label>
          <textarea
            className={[
              'w-full rounded-lg border-2 px-3 py-2.5 text-sm outline-none transition-colors resize-none',
              'bg-cream dark:bg-forest-dark text-ink-dark dark:text-ink-light',
              'min-h-[150px]',
              'border-forest/20 focus:border-forest-light',
            ].join(' ')}
            placeholder="记录你的想法..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        {/* 分类 */}
        <Select
          label="分类"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={setCategory}
        />

        {/* 标签 */}
        <Input
          label="标签（用逗号分隔）"
          placeholder="如：灵感, 待办, 重要"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        {/* 置顶开关 */}
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-ink-dark dark:text-ink-light">
            置顶
          </span>
          <button
            onClick={() => setIsPinned(!isPinned)}
            className={[
              'relative w-10 h-5 rounded-full transition-colors',
              isPinned ? 'bg-forest' : 'bg-forest/20',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 w-4 h-4 rounded-full bg-cream shadow transition-transform gpu-accelerated',
                isPinned ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
        </div>

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
