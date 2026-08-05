/**
 * 手绘半屏画板组件
 * 功能：多种画笔、颜色选择、图形工具、文字输入、撤销/重做、多背景、导出 PNG
 * 使用 Canvas API
 */
import { useState, useRef, useEffect, useCallback, MouseEvent, TouchEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';

// ============ 类型定义 ============
/** 工具类型 */
type ToolType = 'pen' | 'marker' | 'eraser' | 'line' | 'rect' | 'circle' | 'text';

/** 背景类型 */
type BgType = 'white' | 'grid' | 'dot' | 'line';

/** 画笔状态 */
interface DrawState {
  tool: ToolType;
  color: string;
  lineWidth: number;
  bgType: BgType;
}

/** 绘图快照（用于撤销/重做） */
interface Snapshot {
  dataUrl: string;
}

// ============ Props ============
interface DrawingBoardProps {
  open: boolean;
  onClose: () => void;
  /** 导出回调：返回图片 URL */
  onExport: (dataUrl: string) => void;
}

/** 颜色调色板 */
const COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#D64550', '#E8A87C', '#F0D58C', '#5A7A4A',
  '#7DBF8A', '#1A3C2A', '#C4A882', '#4A90D9',
  '#8E44AD', '#E74C3C', '#2ECC71', '#F39C12',
];

/** 背景类型 */
const BG_TYPES: { value: BgType; label: string }[] = [
  { value: 'white', label: '白纸' },
  { value: 'grid', label: '网格' },
  { value: 'dot', label: '点阵' },
  { value: 'line', label: '横线' },
];

/** 画笔粗细 */
const LINE_WIDTHS = [2, 4, 8, 12];

/**
 * 手绘半屏画板组件
 */
export function DrawingBoard({ open, onClose, onExport }: DrawingBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawState, setDrawState] = useState<DrawState>({
    tool: 'pen',
    color: '#000000',
    lineWidth: 2,
    bgType: 'white',
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  // 图形绘制用：起始点
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const toast = useToast();

  // ============ 初始化画布 ============

  /** 初始化画布尺寸及背景 */
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = Math.min(rect.height, window.innerHeight * 0.5);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 绘制背景
    drawBackground(ctx, width, height, drawState.bgType);
  }, [drawState.bgType]);

  useEffect(() => {
    if (open) {
      setTimeout(initCanvas, 100);
    }
  }, [open, initCanvas]);

  // ============ 绘制背景 ============
  const drawBackground = (ctx: CanvasRenderingContext2D, w: number, h: number, bg: BgType) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 0.5;

    switch (bg) {
      case 'grid':
        // 网格：20px 间隔
        for (let x = 0; x <= w; x += 20) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y <= h; y += 20) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        break;
      case 'dot':
        // 点阵
        ctx.fillStyle = '#CCCCCC';
        for (let x = 10; x <= w; x += 20) {
          for (let y = 10; y <= h; y += 20) {
            ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
          }
        }
        break;
      case 'line':
        // 横线：30px 间隔
        for (let y = 30; y <= h; y += 30) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        break;
    }
  };

  // ============ 获取画布坐标 ============
  const getCanvasPos = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // ============ 保存快照 ============
  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL();
    setUndoStack((prev) => [...prev.slice(-30), { dataUrl }]);
    setRedoStack([]);
  }, []);

  // ============ 撤销/重做 ============
  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStack.length === 0) return;

    const current = { dataUrl: canvas.toDataURL() };
    setRedoStack((prev) => [...prev, current]);

    const prev = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));

    restoreSnapshot(prev.dataUrl);
  };

  const redo = () => {
    const canvas = canvasRef.current;
    if (!canvas || redoStack.length === 0) return;

    const current = { dataUrl: canvas.toDataURL() };
    setUndoStack((prev) => [...prev, current]);

    const next = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, -1));

    restoreSnapshot(next.dataUrl);
  };

  const restoreSnapshot = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx?.clearRect(0, 0, w, h);
      ctx?.drawImage(img, 0, 0, w, h);
    };
    img.src = dataUrl;
  };

  // ============ 绘制方法 ============
  const getCtx = (): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    return canvas?.getContext('2d') || null;
  };

  const setStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = drawState.tool === 'eraser' ? '#FFFFFF' : drawState.color;
    ctx.fillStyle = drawState.color;
    ctx.lineWidth = drawState.tool === 'marker' ? drawState.lineWidth * 2 : drawState.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  // ============ 事件处理 ============

  const handleStart = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const ctx = getCtx();
    if (!ctx) return;

    setIsDrawing(true);
    saveSnapshot();

    setStyle(ctx);

    if (['pen', 'marker', 'eraser'].includes(drawState.tool)) {
      // 自由绘制
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    } else if (['line', 'rect', 'circle'].includes(drawState.tool)) {
      // 图形：记录起始点
      setStartPos(pos);
    } else if (drawState.tool === 'text') {
      // 弹出文字输入
      const text = prompt('请输入文字：');
      if (text) {
        ctx.font = `${drawState.lineWidth * 8}px sans-serif`;
        ctx.fillText(text, pos.x, pos.y);
      }
    }
  };

  const handleMove = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const pos = getCanvasPos(e);
    const ctx = getCtx();
    if (!ctx) return;

    if (['pen', 'marker', 'eraser'].includes(drawState.tool)) {
      // 自由绘制
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (startPos && ['line', 'rect', 'circle'].includes(drawState.tool)) {
      // 图形工具需要恢复快照重绘
      restoreSnapshot(undoStack[undoStack.length - 1]?.dataUrl || '');
      setStyle(ctx);
      drawShapePreview(ctx, startPos, pos, drawState.tool);
    }
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    const ctx = getCtx();
    if (startPos && ctx && ['line', 'rect', 'circle'].includes(drawState.tool)) {
      // 先恢复快照再画最终图形
      restoreSnapshot(undoStack[undoStack.length - 1]?.dataUrl || '');
      setStyle(ctx);
      drawShapePreview(ctx, startPos, getCanvasPos({ clientX: 0, clientY: 0 } as any), drawState.tool);
    }
    setIsDrawing(false);
    setStartPos(null);
  };

  /** 绘制图形预览 */
  const drawShapePreview = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    tool: ToolType,
  ) => {
    ctx.beginPath();
    switch (tool) {
      case 'line':
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        break;
      case 'rect': {
        const w = to.x - from.x;
        const h = to.y - from.y;
        ctx.rect(from.x, from.y, w, h);
        break;
      }
      case 'circle': {
        const r = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
        ctx.arc(from.x, from.y, r, 0, Math.PI * 2);
        break;
      }
    }
    ctx.stroke();
  };

  // ============ 导出 PNG ============
  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error('画布不可用');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    onExport(dataUrl);
    toast.success('画板已导出');
    onClose();
  };

  // ============ 清空 ============
  const handleClear = () => {
    saveSnapshot();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    drawBackground(ctx!, w, h, drawState.bgType);
  };

  // ============ 切换到移动事件 ============
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

  // ============ 渲染 ============
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex flex-col bg-cream dark:bg-forest-dark" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* 顶部工具栏 */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-forest/15 flex items-center gap-2 overflow-x-auto">
        {/* 关闭 */}
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded text-secondary hover:bg-forest/10"
          aria-label="关闭"
        >
          ✕
        </button>

        {/* 工具选择 */}
        <div className="flex gap-1">
          {(['pen', 'marker', 'eraser', 'line', 'rect', 'circle', 'text'] as ToolType[]).map((tool) => (
            <button
              key={tool}
              onClick={() => setDrawState((s) => ({ ...s, tool }))}
              className={[
                'w-8 h-8 flex items-center justify-center rounded text-xs transition-colors',
                drawState.tool === tool
                  ? 'bg-forest text-cream'
                  : 'bg-forest/10 text-forest hover:bg-forest/20',
              ].join(' ')}
              title={tool}
            >
              {tool}
            </button>
          ))}
        </div>

        {/* 分隔 */}
        <div className="w-px h-6 bg-forest/20" />

        {/* 颜色选择 */}
        <div className="flex gap-1 items-center">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setDrawState((s) => ({ ...s, color: c }))}
              className={[
                'w-6 h-6 rounded-full border-2 transition-transform',
                drawState.color === c ? 'border-ink-dark scale-110' : 'border-transparent',
              ].join(' ')}
              style={{ backgroundColor: c }}
              aria-label={`颜色 ${c}`}
            />
          ))}
        </div>

        {/* 分隔 */}
        <div className="w-px h-6 bg-forest/20" />

        {/* 线条粗细 */}
        <div className="flex gap-1">
          {LINE_WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setDrawState((s) => ({ ...s, lineWidth: w }))}
              className={[
                'w-8 h-8 flex items-center justify-center rounded text-xs transition-colors',
                drawState.lineWidth === w
                  ? 'bg-forest text-cream'
                  : 'bg-forest/10 text-forest',
              ].join(' ')}
            >
              {w}
            </button>
          ))}
        </div>

        {/* 分隔 */}
        <div className="w-px h-6 bg-forest/20" />

        {/* 背景选择 */}
        <div className="flex gap-1">
          {BG_TYPES.map((bg) => (
            <button
              key={bg.value}
              onClick={() => setDrawState((s) => ({ ...s, bgType: bg.value }))}
              className={[
                'px-2 h-8 flex items-center rounded text-xs transition-colors',
                drawState.bgType === bg.value
                  ? 'bg-forest text-cream'
                  : 'bg-forest/10 text-forest',
              ].join(' ')}
            >
              {bg.label}
            </button>
          ))}
        </div>

        {/* 弹性空间 */}
        <div className="flex-1" />

        {/* 操作按钮 */}
        <Button variant="ghost" size="sm" onClick={undo} disabled={undoStack.length === 0}>
          ↩ 撤销
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={redoStack.length === 0}>
          ↪ 重做
        </Button>
        <Button variant="ghost" size="sm" onClick={handleClear}>
          🗑 清空
        </Button>
        <Button variant="primary" size="sm" onClick={handleExport}>
          📤 导出
        </Button>
      </div>

      {/* 画布区域 */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair touch-none"
          onMouseDown={!isTouchDevice ? handleStart : undefined}
          onMouseMove={!isTouchDevice ? handleMove : undefined}
          onMouseUp={!isTouchDevice ? handleEnd : undefined}
          onMouseLeave={!isTouchDevice ? handleEnd : undefined}
          onTouchStart={isTouchDevice ? handleStart : undefined}
          onTouchMove={isTouchDevice ? handleMove : undefined}
          onTouchEnd={isTouchDevice ? handleEnd : undefined}
        />
      </div>
    </div>
  );
}
