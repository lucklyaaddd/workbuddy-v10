/**
 * 倒数日新增/编辑表单
 * 字段：名称、类型（已过去 / 还剩 / 每年生日）、目标日期、主题色
 */
import { useState, useEffect } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { putCachedCountdown } from '@/lib/countdownCache';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Countdown, CountdownMode, CountdownKind } from '@/types';

// ============ Props ============
interface CountdownFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editCountdown?: Countdown | null;
}

const MODES: { value: CountdownMode; label: string }[] = [
  { value: 'since', label: '已过去' },
  { value: 'until', label: '还剩' },
  { value: 'birthday', label: '每年生日' },
];

const COLORS = ['#5A7A4A', '#D64550', '#E8A87C', '#7DBF8A', '#F0D58C'];

/**
 * 倒数日表单组件
 */
export function CountdownForm({ open, onClose, onSaved, editCountdown }: CountdownFormProps) {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<CountdownMode>('since');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  // ============ 初始化表单 ============
  useEffect(() => {
    if (!open) return;
    if (editCountdown) {
      setTitle(editCountdown.title);
      setMode(editCountdown.mode);
      setTargetDate(editCountdown.target_date);
      setColor(editCountdown.color);
    } else {
      setTitle('');
      setMode('since');
      setTargetDate('');
      setColor(null);
    }
    setErrors({});
  }, [open, editCountdown]);

  // ============ 验证 ============
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = '请输入名称';
    if (!targetDate) e.targetDate = '请选择日期';
    setErrors(e);
    return Object.keys(e).length === 0;
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

    const base = {
      title: title.trim(),
      target_date: targetDate,
      mode,
      kind: (mode === 'birthday' ? 'birthday' : 'custom') as CountdownKind,
      color,
      user_id: userId,
      updated_at: new Date().toISOString(),
      version: (editCountdown?.version || 0) + 1,
    };

    try {
      let saved: Countdown;
      if (editCountdown) {
        const { error } = await supabase
          .from('countdowns')
          .update(base)
          .eq('id', editCountdown.id);
        if (error) throw error;
        saved = { ...editCountdown, ...base };
      } else {
        const { data, error } = await supabase
          .from('countdowns')
          .insert(base)
          .select()
          .single();
        if (error) throw error;
        saved = data as Countdown;
      }

      await putCachedCountdown(saved);
      toast.success(editCountdown ? '已更新' : '已保存');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editCountdown ? '编辑倒数日' : '新增倒数日'}
      maxWidth="520px"
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
      <div className="space-y-5">
        {/* 名称 */}
        <Input
          label="名称 *"
          placeholder="如：在一起、下一次生日、三亚旅行"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />

        {/* 类型 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">类型</label>
          <div className="flex gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                  mode === m.value
                    ? 'border-forest bg-forest/10 text-forest'
                    : 'border-forest/20 text-secondary'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-secondary mt-1">
            {mode === 'since' && '显示从那天起到今天已过去多少天（如「在一起 520 天」）'}
            {mode === 'until' && '显示距离目标日期还剩多少天'}
            {mode === 'birthday' && '按每年循环计算，距离下次生日还剩多少天（年份随意填）'}
          </p>
        </div>

        {/* 日期 */}
        <Input
          label="日期 *"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          error={errors.targetDate}
        />

        {/* 主题色 */}
        <div>
          <label className="block text-sm font-medium text-ink-dark dark:text-ink-light mb-1.5">
            主题色（可选）
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setColor(null)}
              className={`w-8 h-8 rounded-full border-2 ${color === null ? 'border-forest' : 'border-transparent'}`}
              style={{ background: '#FDF8EC' }}
              aria-label="默认色"
            />
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-forest' : 'border-transparent'}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
