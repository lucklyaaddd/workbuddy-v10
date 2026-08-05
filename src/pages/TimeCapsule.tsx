/**
 * 时光胶囊页面
 * Tab 切换：情侣日志 / 备忘录
 * 情侣日志 Tab：CoupleLogList + CoupleLogForm + 画板入口
 * 备忘录 Tab：MemoList + MemoEditor + 画板入口
 */
import { useState, useCallback } from 'react';
import { CoupleLogList } from '@/components/capsule/CoupleLogList';
import { CoupleLogForm } from '@/components/capsule/CoupleLogForm';
import { MemoList } from '@/components/capsule/MemoList';
import { MemoEditor } from '@/components/capsule/MemoEditor';
import { DrawingBoard } from '@/components/capsule/DrawingBoard';
import { Button } from '@/components/ui/Button';
import type { CoupleLog, Memo } from '@/types';

/** Tab 类型 */
type TabType = 'couple' | 'memos';

export default function TimeCapsule() {
  const [activeTab, setActiveTab] = useState<TabType>('couple');

  // 情侣日志状态
  const [coupleFormOpen, setCoupleFormOpen] = useState(false);
  const [editLog, setEditLog] = useState<CoupleLog | null>(null);
  const [coupleRefreshKey, setCoupleRefreshKey] = useState(0);

  // 备忘录状态
  const [memoFormOpen, setMemoFormOpen] = useState(false);
  const [editMemo, setEditMemo] = useState<Memo | null>(null);
  const [memoRefreshKey, setMemoRefreshKey] = useState(0);

  // 画板状态
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [drawingImage, setDrawingImage] = useState<string | null>(null);

  // ============ 回调 ============
  const handleCoupleSaved = useCallback(() => {
    setCoupleRefreshKey((k) => k + 1);
  }, []);

  const handleMemoSaved = useCallback(() => {
    setMemoRefreshKey((k) => k + 1);
  }, []);

  /** 画板导出回调 */
  const handleDrawingExport = (dataUrl: string) => {
    setDrawingImage(dataUrl);
  };

  /** 清除画板图片 */
  const clearDrawing = () => setDrawingImage(null);

  // ============ 渲染 ============
  return (
    <div className="space-y-4">
      {/* 页面标题 + 新增按钮 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-dark dark:text-ink-light">
          时光胶囊
        </h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => setDrawingOpen(true)}
          >
            ✏️ 画板
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              if (activeTab === 'couple') {
                setEditLog(null);
                setCoupleFormOpen(true);
              } else {
                setEditMemo(null);
                setMemoFormOpen(true);
              }
            }}
          >
            {activeTab === 'couple' ? '+ 记录' : '+ 备忘录'}
          </Button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex bg-forest/5 dark:bg-forest-dark/50 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('couple')}
          className={[
            'flex-1 py-2.5 text-sm font-medium rounded-md transition-all',
            'active:scale-95 gpu-accelerated',
            activeTab === 'couple'
              ? 'bg-gradient-to-r from-red-400 to-pink-400 text-cream shadow-sm'
              : 'text-secondary',
          ].join(' ')}
        >
          💕 情侣日志
        </button>
        <button
          onClick={() => setActiveTab('memos')}
          className={[
            'flex-1 py-2.5 text-sm font-medium rounded-md transition-all',
            'active:scale-95 gpu-accelerated',
            activeTab === 'memos'
              ? 'bg-forest text-cream shadow-sm'
              : 'text-secondary',
          ].join(' ')}
        >
          ✏️ 备忘录
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === 'couple' ? (
        <CoupleLogList key={coupleRefreshKey} />
      ) : (
        <MemoList key={memoRefreshKey} />
      )}

      {/* 情侣日志表单 */}
      <CoupleLogForm
        open={coupleFormOpen}
        onClose={() => { setCoupleFormOpen(false); setEditLog(null); }}
        onSaved={handleCoupleSaved}
        editLog={editLog}
        drawingImage={drawingImage}
        onClearDrawing={clearDrawing}
      />

      {/* 备忘录表单 */}
      <MemoEditor
        open={memoFormOpen}
        onClose={() => { setMemoFormOpen(false); setEditMemo(null); }}
        onSaved={handleMemoSaved}
        editMemo={editMemo}
        drawingImage={drawingImage}
        onClearDrawing={clearDrawing}
        onOpenDrawingBoard={() => setDrawingOpen(true)}
      />

      {/* 画板 */}
      <DrawingBoard
        open={drawingOpen}
        onClose={() => setDrawingOpen(false)}
        onExport={handleDrawingExport}
      />
    </div>
  );
}
