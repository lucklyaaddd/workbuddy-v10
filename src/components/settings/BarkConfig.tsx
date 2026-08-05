/**
 * Bark 推送配置组件
 * 功能：Bark URL 输入、设备名称、隐私告知、保存、已绑定设备列表、推送总开关、删除设备
 * 注意:「测试推送」按钮已移除(后端 api/bark/test.ts endpoint 已合并删除,
 *       节省 Vercel Hobby Serverless Function 配额)。如需验证推送,请绑定后等待真实提醒触发。
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { escapeHtml } from '@/lib/utils';
import { saveBarkSubscription, getSubscriptions, deleteSubscription } from '@/lib/bark';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading } from '@/components/ui/Loading';

// ============ 类型定义 ============
/** 已绑定设备 */
interface BoundDevice {
  id: string;
  device_name: string;
  endpoint: string;
  created_at: string;
}

/**
 * Bark 推送配置组件
 */
export function BarkConfig() {
  const [barkUrl, setBarkUrl] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<BoundDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<BoundDevice | null>(null);
  const toast = useToast();

  // ============ 数据加载 ============

  /** 加载设备列表 */
  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    const list = await getSubscriptions();
    setDevices(list || []);
    setLoadingDevices(false);
  }, []);

  /** 加载推送开关状态 */
  const loadPushEnabled = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { data } = await supabase
      .from('user_preferences')
      .select('push_enabled')
      .eq('user_id', userId)
      .single();

    if (data) {
      setPushEnabled(data.push_enabled);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    loadPushEnabled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在 mount 时加载一次，避免 useToast 引用变化触发死循环

  // ============ 保存绑定 ============
  const handleSave = async () => {
    if (!barkUrl.trim()) {
      toast.warning('请输入 Bark URL');
      return;
    }
    if (!deviceName.trim()) {
      toast.warning('请输入设备名称');
      return;
    }
    if (!privacyChecked) {
      toast.warning('请先阅读并同意隐私告知');
      return;
    }

    setSaving(true);
    const result = await saveBarkSubscription(barkUrl.trim(), deviceName.trim());
    setSaving(false);

    if (result.success) {
      toast.success('绑定成功');
      setBarkUrl('');
      setDeviceName('');
      setPrivacyChecked(false);
      loadDevices();
    } else {
      toast.error(result.error || '绑定失败');
    }
  };

  // ============ 推送总开关 ============
  const togglePushEnabled = async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const newValue = !pushEnabled;
    setPushEnabled(newValue);

    const { error } = await supabase
      .from('user_preferences')
      .update({ push_enabled: newValue })
      .eq('user_id', userId);

    if (error) {
      setPushEnabled(!newValue);
      toast.error('更新失败');
    }
  };

  // ============ 删除设备 ============
  const handleDeleteDevice = async () => {
    if (!deleteTarget) return;
    const result = await deleteSubscription(deleteTarget.id);
    if (result.success) {
      toast.success('已删除');
      loadDevices();
    } else {
      toast.error(result.error || '删除失败');
    }
    setDeleteTarget(null);
  };

  // ============ Endpoint 脱敏 ============
  const maskEndpoint = (endpoint: string): string => {
    if (endpoint.length <= 8) return '****';
    return `${endpoint.substring(0, 4)}****${endpoint.substring(endpoint.length - 4)}`;
  };

  // ============ 渲染 ============
  return (
    <div className="space-y-4">
      {/* 新增绑定 */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-3">
          新增绑定
        </h3>

        <div className="space-y-3">
          {/* Bark URL */}
          <Input
            label="Bark URL"
            placeholder="https://api.day.app/your_key"
            value={barkUrl}
            onChange={(e) => setBarkUrl(e.target.value)}
          />

          {/* 设备名称 */}
          <Input
            label="设备名称"
            placeholder="如：我的iPhone"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />

          {/* 隐私告知 */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="privacy-consent"
              checked={privacyChecked}
              onChange={(e) => setPrivacyChecked(e.target.checked)}
              className="mt-1 accent-forest"
            />
            <label htmlFor="privacy-consent" className="text-xs text-secondary leading-relaxed">
              我已了解：Bark URL 将经服务器加密后存储，仅用于推送提醒通知，不会用于其他目的。
            </label>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={handleSave}
              loading={saving}
            >
              保存
            </Button>
          </div>
        </div>
      </Card>

      {/* 推送总开关 */}
      <Card padding="md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink-dark dark:text-ink-light">推送通知</p>
            <p className="text-xs text-secondary">关闭后将不再接收推送提醒</p>
          </div>
          <button
            onClick={togglePushEnabled}
            className={[
              'relative w-10 h-5 rounded-full transition-colors',
              pushEnabled ? 'bg-forest' : 'bg-forest/20',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 w-4 h-4 rounded-full bg-cream shadow transition-transform gpu-accelerated',
                pushEnabled ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
        </div>
      </Card>

      {/* 已绑定设备列表 */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-3">
          已绑定设备
        </h3>

        {loadingDevices ? (
          <Loading size="sm" text="加载中..." />
        ) : devices.length === 0 ? (
          <p className="text-xs text-secondary">暂无设备</p>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-forest/5 dark:bg-forest-dark/30"
              >
                <div>
                  <p className="text-sm text-ink-dark dark:text-ink-light">
                    {escapeHtml(device.device_name)}
                  </p>
                  <p className="text-xs text-secondary font-mono">
                    {maskEndpoint(device.endpoint)}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteTarget(device)}
                  className="text-xs text-secondary hover:text-accent-red transition-colors"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除设备"
        content={`确定要删除设备「${deleteTarget ? escapeHtml(deleteTarget.device_name) : ''}」的推送订阅吗？`}
        danger
        onConfirm={handleDeleteDevice}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
