/**
 * "设置在一起日期"小弹窗
 * 用户在情侣日志页面顶部点击"设置在一起纪念日"时调用
 * 保存到 user_preferences.together_since（TEXT，YYYY-MM-DD）
 */
import { useState, useEffect } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface TogetherDateFormProps {
  open: boolean;
  currentValue: string | null; // 已设的日期（YYYY-MM-DD 或 null）
  onClose: () => void;
  onSaved: (newValue: string | null) => void;
}

export function TogetherDateForm({ open, currentValue, onClose, onSaved }: TogetherDateFormProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setValue(currentValue ?? '');
    setError(null);
  }, [open, currentValue]);

  // 不能选未来日期（在一起纪念日不能是明天）
  const today = new Date();
  const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handleSave = async () => {
    if (!value) {
      setError('请选择日期');
      return;
    }
    if (value > maxDate) {
      setError('日期不能晚于今天');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        toast.error('请先登录');
        return;
      }

      // upsert：每个用户只一行偏好记录，唯一索引 (user_id)
      const { error: upsertErr } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, together_since: value, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (upsertErr) throw upsertErr;

      toast.success('已保存');
      onSaved(value);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="设置在一起纪念日"
      maxWidth="420px"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="在一起日期 *"
          type="date"
          value={value}
          max={maxDate}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          error={error ?? undefined}
        />
        <p className="text-xs text-secondary leading-relaxed">
          设置后会显示在情侣日志顶部"💞 已经在一起 N 天啦"，无设置则不显示该卡片（避免用第一条日志误推算为 0 天）。
        </p>
      </div>
    </Modal>
  );
}

