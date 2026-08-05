/**
 * 待办新增/编辑表单组件
 * 功能：内容输入、日期时间选择、提前提醒、表单验证
 * 编辑时自动重置 is_reminded
 */
import { useState, useEffect } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { today, nowTime } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Todo } from '@/types';

// ============ 类型定义 ============
interface TodoFormProps {
  open: boolean;                // 是否打开
  onClose: () => void;          // 关闭回调
  onSaved: () => void;          // 保存成功回调
  editTodo?: Todo | null;      // 编辑模式下的待办数据
}

/** 提醒选项 */
const REMIND_OPTIONS = [
  { value: '0', label: '准时' },
  { value: '5', label: '提前5分钟' },
  { value: '15', label: '提前15分钟' },
  { value: '30', label: '提前30分钟' },
  { value: '60', label: '提前1小时' },
];

/**
 * 待办表单组件
 */
export function TodoForm({ open, onClose, onSaved, editTodo }: TodoFormProps) {
  const [content, setContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState(today());
  const [scheduledTime, setScheduledTime] = useState('');
  const [remindOffset, setRemindOffset] = useState('0');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  // ============ 初始化表单 ============
  useEffect(() => {
    if (open) {
      if (editTodo) {
        // 编辑模式：填充现有数据
        setContent(editTodo.content);
        setScheduledDate(editTodo.scheduled_date);
        setScheduledTime(editTodo.scheduled_time || '');
        setRemindOffset(String(editTodo.remind_offset || 0));
      } else {
        // 新增模式：使用默认值
        setContent('');
        setScheduledDate(today());
        setScheduledTime(nowTime());
        setRemindOffset('0');
      }
      setErrors({});
    }
  }, [open, editTodo]);

  // ============ 表单验证 ============
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!content.trim()) {
      newErrors.content = '请输入待办内容';
    }
    if (!scheduledDate) {
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
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime || null,
      remind_offset: parseInt(remindOffset, 10),
      user_id: userId,
    };

    try {
      if (editTodo) {
        // 编辑模式：更新时间并重置提醒标记
        const { error } = await supabase
          .from('todos')
          .update({ ...payload, is_reminded: false })
          .eq('id', editTodo.id);

        if (error) throw error;
        toast.success('待办已更新');
      } else {
        // 新增模式
        const { error } = await supabase.from('todos').insert(payload);
        if (error) throw error;
        toast.success('待办已创建');
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
      title={editTodo ? '编辑待办' : '新增待办'}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
            {editTodo ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 待办内容 */}
        <Input
          label="待办内容"
          placeholder="请输入待办事项..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          error={errors.content}
          autoFocus
        />

        {/* 日期选择 */}
        <Input
          label="日期"
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          error={errors.date}
        />

        {/* 时间选择 */}
        <Input
          label="时间（可选）"
          type="time"
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
        />

        {/* 提醒时间 */}
        <Select
          label="提前提醒"
          options={REMIND_OPTIONS}
          value={remindOffset}
          onChange={setRemindOffset}
        />
      </div>
    </Modal>
  );
}
