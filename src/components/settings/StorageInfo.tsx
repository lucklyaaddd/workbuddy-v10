/**
 * 存储信息组件
 * 功能：展示存储占用情况、进度条、80%预警
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';

// ============ 常量定义 ============
const STORAGE_LIMIT_MB = 100; // 存储上限100MB
const WARNING_THRESHOLD = 0.8; // 80%预警

/**
 * 存储信息组件
 */
export function StorageInfo() {
  const [loading, setLoading] = useState(true);
  const [usedSize, setUsedSize] = useState(0); // 字节
  const [error, setError] = useState('');

  // ============ 加载存储信息 ============
  const loadStorageInfo = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      setError('未登录');
      setLoading(false);
      return;
    }

    try {
      // 查询用户上传的所有文件
      const { data, error } = await supabase
        .storage
        .from('user-files')
        .list(userId, {
          limit: 1000,
        });

      if (error) {
        setError('获取存储信息失败');
        setLoading(false);
        return;
      }

      // 计算总大小
      const totalBytes = (data || []).reduce((sum, file) => {
        return sum + (file.metadata?.size || 0);
      }, 0);

      setUsedSize(totalBytes);
    } catch {
      setError('获取存储信息失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  // ============ 计算 ============
  const usedMB = usedSize / (1024 * 1024);
  const percentage = Math.min(100, (usedMB / STORAGE_LIMIT_MB) * 100);
  const isWarning = percentage >= WARNING_THRESHOLD * 100;

  // ============ 渲染 ============
  if (loading) {
    return (
      <Card padding="md">
        <Loading size="sm" text="加载存储信息..." />
      </Card>
    );
  }

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-3">
        存储信息
      </h3>

      {error ? (
        <p className="text-xs text-secondary">{error}</p>
      ) : (
        <div className="space-y-3">
          {/* 使用量文本 */}
          <div className="flex justify-between text-xs">
            <span className="text-secondary">
              已使用 {usedMB.toFixed(2)} MB
            </span>
            <span className="text-secondary">
              共 {STORAGE_LIMIT_MB} MB
            </span>
          </div>

          {/* 进度条 */}
          <div className="w-full h-3 rounded-full bg-forest/10 overflow-hidden">
            <div
              className={[
                'h-full rounded-full transition-all',
                isWarning ? 'bg-accent-red animate-pulse' : 'bg-forest',
              ].join(' ')}
              style={{ width: `${Math.max(2, percentage)}%` }}
            />
          </div>

          {/* 百分比 */}
          <p className={[
            'text-xs font-medium',
            isWarning ? 'text-accent-red' : 'text-forest',
          ].join(' ')}>
            {percentage.toFixed(1)}%
          </p>

          {/* 预警提示 */}
          {isWarning && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-red/10 border border-accent-red/20 text-xs text-accent-red">
              <span>⚠️</span>
              <span>存储空间使用已超过{Math.round(WARNING_THRESHOLD * 100)}%，建议清理不需要的文件</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
