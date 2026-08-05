/**
 * 财富工坊页面
 * 整合 TransactionForm + TransactionList + WealthCharts
 */
import { useState, useCallback } from 'react';
import { TransactionForm } from '@/components/wealth/TransactionForm';
import { TransactionList } from '@/components/wealth/TransactionList';
import { WealthCharts } from '@/components/wealth/WealthCharts';
import { Button } from '@/components/ui/Button';
import type { Transaction } from '@/types';

export default function Wealth() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCharts, setShowCharts] = useState(true);

  // ============ 保存成功 ============
  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // ============ 打开新增 ============
  const handleAdd = () => {
    setEditTransaction(null);
    setFormOpen(true);
  };

  // ============ 打开编辑 ============
  const handleEdit = (tx: Transaction) => {
    setEditTransaction(tx);
    setFormOpen(true);
  };

  // ============ 渲染 ============
  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-dark dark:text-ink-light">
          财富工坊
        </h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowCharts(!showCharts)}
          >
            {showCharts ? '📋 列表' : '📊 图表'}
          </Button>
          <Button variant="primary" size="md" onClick={handleAdd}>
            + 记一笔
          </Button>
        </div>
      </div>

      {/* 数据可视化 */}
      {showCharts && <WealthCharts key={refreshKey} />}

      {/* 记账列表 */}
      {!showCharts && (
        <TransactionList
          refreshKey={refreshKey}
          onEdit={handleEdit}
        />
      )}

      {/* 新增/编辑弹窗 */}
      <TransactionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTransaction(null); }}
        onSaved={handleSaved}
        editTransaction={editTransaction}
      />
    </div>
  );
}
