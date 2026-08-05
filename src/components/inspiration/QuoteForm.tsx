/**
 * 好词好句新增/编辑表单组件
 * 功能：内容、作者、分类、来源输入
 */
import { useState, useEffect } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Quote, QuoteCategory } from '@/types';

// ============ 类型定义 ============
interface QuoteFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editQuote?: Quote | null;
}

/** 分类选项 */
const CATEGORY_OPTIONS = [
  { value: '', label: '请选择分类' },
  { value: '励志', label: '励志' },
  { value: '哲思', label: '哲思' },
  { value: '爱情', label: '爱情' },
  { value: '古诗词', label: '古诗词' },
  { value: '生活', label: '生活' },
];

/**
 * 好词好句表单组件
 */
export function QuoteForm({ open, onClose, onSaved, editQuote }: QuoteFormProps) {
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState<QuoteCategory | ''>('');
  const [source, setSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  // ============ 初始化表单 ============
  useEffect(() => {
    if (open) {
      if (editQuote) {
        setContent(editQuote.content);
        setAuthor(editQuote.author || '');
        setCategory(editQuote.category || '');
        setSource(editQuote.source || '');
      } else {
        setContent('');
        setAuthor('');
        setCategory('');
        setSource('');
      }
      setErrors({});
    }
  }, [open, editQuote]);

  // ============ 验证 ============
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!content.trim()) {
      newErrors.content = '请输入句子内容';
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
      author: author.trim(),
      category: category || null,
      source: source.trim(),
      user_id: userId,
    };

    try {
      if (editQuote) {
        const { error } = await supabase
          .from('quotes')
          .update(payload)
          .eq('id', editQuote.id);

        if (error) throw error;
        toast.success('已更新');
      } else {
        const { error } = await supabase.from('quotes').insert(payload);
        if (error) throw error;
        toast.success('已收藏');
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
      title={editQuote ? '编辑好词好句' : '收藏好词好句'}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            {editQuote ? '保存' : '收藏'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 句子内容 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">
            句子内容 *
          </label>
          <textarea
            className={[
              'w-full rounded-lg border-2 px-3 py-2.5 text-sm outline-none transition-colors resize-none',
              'bg-cream dark:bg-forest-dark text-ink-dark dark:text-ink-light',
              'min-h-[100px]',
              errors.content ? 'border-accent-red' : 'border-forest/20 focus:border-forest-light',
            ].join(' ')}
            placeholder="输入打动人心的句子..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoFocus
          />
          {errors.content && (
            <p className="mt-1 text-xs text-accent-red">{errors.content}</p>
          )}
        </div>

        {/* 作者 */}
        <Input
          label="作者（可选）"
          placeholder="如：村上春树"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />

        {/* 分类 */}
        <Select
          label="分类"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(val) => setCategory(val as QuoteCategory | '')}
        />

        {/* 来源 */}
        <Input
          label="来源（可选）"
          placeholder="如：《挪威的森林》"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </div>
    </Modal>
  );
}
