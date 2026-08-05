/**
 * 灵感补给站页面
 * 整合 QuoteList + QuoteForm
 */
import { useState, useCallback } from 'react';
import { QuoteList } from '@/components/inspiration/QuoteList';
import { QuoteForm } from '@/components/inspiration/QuoteForm';
import { Button } from '@/components/ui/Button';
import type { Quote } from '@/types';

export default function Inspiration() {
  const [formOpen, setFormOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleAdd = () => {
    setEditQuote(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-dark dark:text-ink-light">
          灵感补给站
        </h2>
        <Button variant="primary" size="md" onClick={handleAdd}>
          + 收藏句子
        </Button>
      </div>

      {/* 好词好句列表 */}
      <QuoteList key={refreshKey} />

      {/* 新增/编辑弹窗 */}
      <QuoteForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditQuote(null); }}
        onSaved={handleSaved}
        editQuote={editQuote}
      />
    </div>
  );
}
