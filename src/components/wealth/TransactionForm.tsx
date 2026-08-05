/**
 * 记账表单组件
 * 功能：收入/支出切换、金额输入、分类选择、日期、备注、可选配图
 */
import { useState, useEffect } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { today, formatAmount } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUploader } from '@/components/common/ImageUploader';
import type { Transaction, TransactionType } from '@/types';

// ============ 类型定义 ============
interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editTransaction?: Transaction | null;
}

/** 支出分类 */
const EXPENSE_CATEGORIES = [
  { value: '餐饮', label: '🍜 餐饮' },
  { value: '交通', label: '🚗 交通' },
  { value: '购物', label: '🛍️ 购物' },
  { value: '娱乐', label: '🎮 娱乐' },
  { value: '医疗', label: '🏥 医疗' },
  { value: '住房', label: '🏠 住房' },
  { value: '教育', label: '📚 教育' },
  { value: '其他支出', label: '📦 其他' },
];

/** 收入分类 */
const INCOME_CATEGORIES = [
  { value: '工资', label: '💼 工资' },
  { value: '奖金', label: '🎁 奖金' },
  { value: '投资', label: '📈 投资' },
  { value: '其他收入', label: '💰 其他' },
];

/**
 * 记账表单组件
 */
export function TransactionForm({ open, onClose, onSaved, editTransaction }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  // ============ 初始化表单 ============
  useEffect(() => {
    if (open) {
      if (editTransaction) {
        setType(editTransaction.type);
        setAmount(formatAmount(editTransaction.amount));
        setCategory(editTransaction.category);
        setDate(editTransaction.date);
        setNote(editTransaction.note || '');
        setImageUrls(editTransaction.image_urls || []);
      } else {
        setType('expense');
        setAmount('');
        setCategory('');
        setDate(today());
        setNote('');
        setImageUrls([]);
      }
      setErrors({});
    }
  }, [open, editTransaction]);

  // ============ 验证 ============
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const numAmount = parseFloat(amount);
    if (!amount.trim() || isNaN(numAmount) || numAmount <= 0) {
      newErrors.amount = '请输入有效金额';
    }
    if (!category) {
      newErrors.category = '请选择分类';
    }
    if (!date) {
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

    // 金额：以分为单位存储
    const amountInCents = Math.round(parseFloat(amount) * 100);

    const payload = {
      type,
      amount: amountInCents,
      category,
      date,
      note: note.trim(),
      image_urls: imageUrls,
      user_id: userId,
    };

    try {
      if (editTransaction) {
        const { error } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', editTransaction.id);

        if (error) throw error;
        toast.success('已更新');
      } else {
        const { error } = await supabase.from('transactions').insert(payload);
        if (error) throw error;
        toast.success(type === 'income' ? '收入已记录' : '支出已记录');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // ============ 当前可用分类 ============
  const currentCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // ============ 渲染 ============
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editTransaction ? '编辑记录' : '记一笔'}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            {editTransaction ? '保存' : '记录'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 收入/支出切换 */}
        <div className="flex bg-forest/5 dark:bg-forest-dark/50 rounded-lg p-1">
          <button
            onClick={() => { setType('expense'); setCategory(''); }}
            className={[
              'flex-1 py-2 text-sm font-medium rounded-md transition-all',
              'active:scale-95 gpu-accelerated',
              type === 'expense'
                ? 'bg-accent-red text-cream shadow-sm'
                : 'text-secondary',
            ].join(' ')}
          >
            支出
          </button>
          <button
            onClick={() => { setType('income'); setCategory(''); }}
            className={[
              'flex-1 py-2 text-sm font-medium rounded-md transition-all',
              'active:scale-95 gpu-accelerated',
              type === 'income'
                ? 'bg-forest text-cream shadow-sm'
                : 'text-secondary',
            ].join(' ')}
          >
            收入
          </button>
        </div>

        {/* 金额输入 */}
        <Input
          label="金额（元）"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          prefixIcon={<span className="text-sm text-secondary">¥</span>}
          min="0.01"
          step="0.01"
        />

        {/* 常用类别快捷按钮 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-2">
            分类
          </label>
          <div className="flex flex-wrap gap-2">
            {currentCategories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                  'active:scale-95 gpu-accelerated',
                  category === cat.value
                    ? 'bg-forest text-cream border-forest'
                    : 'bg-cream dark:bg-forest-dark/50 text-secondary border-forest/15 hover:border-forest/40',
                ].join(' ')}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {errors.category && (
            <p className="mt-1 text-xs text-accent-red">{errors.category}</p>
          )}
        </div>

        {/* 日期 */}
        <Input
          label="日期"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
        />

        {/* 备注 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">
            备注（可选）
          </label>
          <textarea
            className={[
              'w-full rounded-lg border-2 px-3 py-2.5 text-sm outline-none transition-colors resize-none',
              'bg-cream dark:bg-forest-dark text-ink-dark dark:text-ink-light',
              'min-h-[60px]',
              'border-forest/20 focus:border-forest-light',
            ].join(' ')}
            placeholder="记账备注..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* 配图上传 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">
            配图（可选）
          </label>
          <ImageUploader
            maxCount={3}
            existingUrls={imageUrls}
            onChange={setImageUrls}
          />
        </div>
      </div>
    </Modal>
  );
}
