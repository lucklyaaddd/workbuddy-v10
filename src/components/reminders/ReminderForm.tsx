/**
 * 提醒新增/编辑表单组件
 * 功能：类型选择、名称、日期、农历开关+公历换算、提前天数、每年重复、周期类型、备注
 */
import { useState, useEffect } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { today, lunarToSolar } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Reminder, ReminderType, CycleType } from '@/types';

// ============ 类型定义 ============
interface ReminderFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editReminder?: Reminder | null;
}

/** 类型选项 */
const TYPE_OPTIONS = [
  { value: 'birthday', label: '🎂 生日' },
  { value: 'custom', label: '🔔 自定义' },
];

/** 提前提醒选项 */
const ADVANCE_OPTIONS = [
  { value: '0', label: '当天' },
  { value: '1', label: '提前1天' },
  { value: '3', label: '提前3天' },
  { value: '7', label: '提前7天' },
  { value: '15', label: '提前15天' },
];

/** 周期选项 */
const CYCLE_OPTIONS: { value: CycleType; label: string }[] = [
  { value: '单次', label: '单次' },
  { value: '每日', label: '每日' },
  { value: '每周', label: '每周' },
  { value: '每月', label: '每月' },
  { value: '每年', label: '每年' },
];

/**
 * 提醒表单组件
 */
export function ReminderForm({ open, onClose, onSaved, editReminder }: ReminderFormProps) {
  const [type, setType] = useState<ReminderType>('custom');
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [lunar, setLunar] = useState(false);
  const [advanceDays, setAdvanceDays] = useState('0');
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [cycleType, setCycleType] = useState<CycleType>('单次');
  const [note, setNote] = useState('');
  const [solarDisplay, setSolarDisplay] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  // ============ 初始化 ============
  useEffect(() => {
    if (open) {
      if (editReminder) {
        setType(editReminder.type);
        setName(editReminder.name);
        setDate(editReminder.date);
        setLunar(editReminder.lunar);
        setAdvanceDays(String(editReminder.advance_days || 0));
        setRepeatYearly(editReminder.repeat_yearly);
        setCycleType(editReminder.cycle_type || '单次');
        setNote(editReminder.note || '');
        if (editReminder.lunar) {
          setSolarDisplay(lunarToSolar(editReminder.date));
        } else {
          setSolarDisplay('');
        }
      } else {
        setType('custom');
        setName('');
        setDate(today());
        setLunar(false);
        setAdvanceDays('0');
        setRepeatYearly(false);
        setCycleType('单次');
        setNote('');
        setSolarDisplay('');
      }
      setErrors({});
    }
  }, [open, editReminder]);

  // ============ 农历公历换算 ============
  useEffect(() => {
    if (lunar && date) {
      // 农历模式：即时换算公历显示
      try {
        const solar = lunarToSolar(date);
        setSolarDisplay(solar !== date ? solar : '');
      } catch {
        setSolarDisplay('');
      }
    } else {
      setSolarDisplay('');
    }
  }, [lunar, date]);

  // ============ 验证 ============
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = '请输入名称';
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

    const payload = {
      type,
      name: name.trim(),
      date,
      lunar,
      advance_days: parseInt(advanceDays, 10),
      repeat_yearly: repeatYearly,
      cycle_type: cycleType,
      note: note.trim(),
      user_id: userId,
    };

    try {
      if (editReminder) {
        const { error } = await supabase
          .from('reminders')
          .update(payload)
          .eq('id', editReminder.id);

        if (error) throw error;
        toast.success('提醒已更新');
      } else {
        const { error } = await supabase.from('reminders').insert(payload);
        if (error) throw error;
        toast.success('提醒已创建');
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
      title={editReminder ? '编辑提醒' : '新增提醒'}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            {editReminder ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 类型选择 */}
        <Select
          label="类型"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(val) => setType(val as ReminderType)}
        />

        {/* 名称 */}
        <Input
          label="名称 *"
          placeholder={type === 'birthday' ? '如：小明的生日' : '提醒名称'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoFocus
        />

        {/* 日期 */}
        <Input
          label={lunar ? '农历日期' : '日期 *'}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
        />

        {/* 农历开关 + 公历换算显示 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-dark dark:text-ink-light">
              农历模式
            </span>
            <button
              onClick={() => setLunar(!lunar)}
              className={[
                'relative w-10 h-5 rounded-full transition-colors',
                lunar ? 'bg-forest' : 'bg-forest/20',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 w-4 h-4 rounded-full bg-cream shadow transition-transform gpu-accelerated',
                  lunar ? 'translate-x-5' : 'translate-x-0.5',
                ].join(' ')}
              />
            </button>
          </div>
          {solarDisplay && (
            <p className="text-xs text-secondary">
              对应公历：{solarDisplay}
            </p>
          )}
        </div>

        {/* 提前提醒天数 */}
        <Select
          label="提前提醒"
          options={ADVANCE_OPTIONS}
          value={advanceDays}
          onChange={setAdvanceDays}
        />

        {/* 每年重复 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-dark dark:text-ink-light">
            每年重复
          </span>
          <button
            onClick={() => setRepeatYearly(!repeatYearly)}
            className={[
              'relative w-10 h-5 rounded-full transition-colors',
              repeatYearly ? 'bg-forest' : 'bg-forest/20',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 w-4 h-4 rounded-full bg-cream shadow transition-transform gpu-accelerated',
                repeatYearly ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
        </div>

        {/* 周期类型 */}
        <Select
          label="周期类型"
          options={CYCLE_OPTIONS}
          value={cycleType}
          onChange={(val) => setCycleType(val as CycleType)}
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
            placeholder="添加备注..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
