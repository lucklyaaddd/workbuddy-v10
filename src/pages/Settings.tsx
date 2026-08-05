/**
 * 设置页面
 * 整合 BarkConfig + DataExport + RecycleBin + StorageInfo + ThemeToggle + 退出登录
 */
import { useAuth } from '@/hooks/useAuth';
import { BarkConfig } from '@/components/settings/BarkConfig';
import { DataExport } from '@/components/settings/DataExport';
import { RecycleBin } from '@/components/settings/RecycleBin';
import { StorageInfo } from '@/components/settings/StorageInfo';
import { ThemeToggle } from '@/components/settings/ThemeToggle';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useState } from 'react';

export default function Settings() {
  const { logout, user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ============ 退出登录 ============
  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  };

  // ============ 渲染 ============
  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <h2 className="text-lg font-bold text-ink-dark dark:text-ink-light">
        设置
      </h2>

      {/* 用户信息 */}
      <Card padding="md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-forest/15 flex items-center justify-center text-2xl">
            👤
          </div>
          <div>
            <p className="text-sm font-medium text-ink-dark dark:text-ink-light">
              {user?.email || '未登录'}
            </p>
            <p className="text-xs text-secondary">已登录</p>
          </div>
        </div>
      </Card>

      {/* 主题切换 */}
      <ThemeToggle />

      {/* Bark 推送配置 */}
      <BarkConfig />

      {/* 数据导出 */}
      <DataExport />

      {/* 存储信息 */}
      <StorageInfo />

      {/* 回收站 */}
      <RecycleBin />

      {/* 退出登录 */}
      <Card padding="md">
        <Button
          variant="danger"
          size="md"
          fullWidth
          onClick={() => setShowLogoutConfirm(true)}
          loading={loggingOut}
        >
          退出登录
        </Button>
      </Card>

      {/* 退出确认 */}
      <ConfirmDialog
        open={showLogoutConfirm}
        title="退出登录"
        content="确定要退出登录吗？离线数据将被清除。"
        danger
        confirmText="退出"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
