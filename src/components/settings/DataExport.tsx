/**
 * 数据导出组件
 * 功能：JSON/CSV 格式选择、二次确认、导出进度、每日上限3次
 */
import { useState, useEffect } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// ============ 常量定义 ============
const DAILY_EXPORT_LIMIT = 3;
const EXPORT_COUNT_KEY = 'workbuddy-export-count';

/** 格式选项 */
const FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' },
];

/**
 * 获取今日已导出次数
 */
function getTodayExportCount(): number {
  const today = new Date().toDateString();
  const stored = JSON.parse(localStorage.getItem(EXPORT_COUNT_KEY) || '{}');
  return stored.date === today ? (stored.count || 0) : 0;
}

/**
 * 增加今日导出计数
 */
function incrementExportCount(): void {
  const today = new Date().toDateString();
  const count = getTodayExportCount() + 1;
  localStorage.setItem(EXPORT_COUNT_KEY, JSON.stringify({ date: today, count }));
}

/** CSV 转义 */
function csvEscape(val: any): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** 将数据转为 CSV 文本 */
function toCSV(data: Record<string, any>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];
  data.forEach((row) => {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  });
  return lines.join('\n');
}

/**
 * 数据导出组件
 */
export function DataExport() {
  const [format, setFormat] = useState('json');
  const [showConfirm, setShowConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const remaining = Math.max(0, DAILY_EXPORT_LIMIT - todayCount);
  const toast = useToast();

  // ============ 初始化 ============
  useEffect(() => {
    setTodayCount(getTodayExportCount());
  }, []);

  // ============ 导出逻辑 ============

  /** 获取所有表的数据 */
  const fetchAllData = async (): Promise<Record<string, any>> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('未登录');

    const tables = ['todos', 'transactions', 'quotes', 'memos', 'couple_logs', 'reminders'];
    const result: Record<string, any> = {};
    const total = tables.length;

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .limit(1000);

      if (!error) {
        result[table] = data || [];
      }

      // 更新进度
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    return result;
  };

  /** 执行导出 */
  const handleExport = async () => {
    setShowConfirm(false);

    if (remaining <= 0) {
      toast.warning(`今日导出次数已达上限（${DAILY_EXPORT_LIMIT}次）`);
      return;
    }

    setExporting(true);
    setProgress(0);

    try {
      const data = await fetchAllData();

      let content: string;
      let mime: string;
      let ext: string;

      if (format === 'csv') {
        // CSV 格式：每张表一个文件，打包成 JSON
        const csvData: Record<string, string> = {};
        Object.entries(data).forEach(([key, rows]) => {
          csvData[key] = toCSV(rows as Record<string, any>[]);
        });
        content = JSON.stringify(csvData, null, 2);
        mime = 'application/json';
        ext = 'csv.json';
      } else {
        content = JSON.stringify(data, null, 2);
        mime = 'application/json';
        ext = 'json';
      }

      // 下载
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workbuddy_backup_${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      incrementExportCount();
      setTodayCount(getTodayExportCount());
      toast.success('导出成功');
    } catch (err: any) {
      toast.error(err.message || '导出失败');
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  // ============ 渲染 ============
  return (
    <>
      <Card padding="md">
        <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-3">
          数据导出
        </h3>

        <div className="space-y-3">
          {/* 格式选择 */}
          <Select
            label="格式"
            options={FORMAT_OPTIONS}
            value={format}
            onChange={setFormat}
          />

          {/* 提示 */}
          <p className="text-xs text-secondary">
            每日剩余导出次数：{remaining} / {DAILY_EXPORT_LIMIT}
          </p>

          {/* 导出按钮 */}
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={() => setShowConfirm(true)}
            loading={exporting}
            disabled={remaining <= 0}
          >
            {exporting ? `导出中 ${progress}%` : '导出数据'}
          </Button>

          {/* 进度条 */}
          {exporting && (
            <div className="w-full h-1.5 rounded-full bg-forest/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-forest transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </Card>

      {/* 二次确认 */}
      <ConfirmDialog
        open={showConfirm}
        title="确认导出"
        content={`确定要导出 ${format.toUpperCase()} 格式的数据吗？本次导出将消耗一次机会（今日剩余${remaining}次）。`}
        onConfirm={handleExport}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
