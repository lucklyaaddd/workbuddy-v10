/**
 * 图片全屏预览组件
 * 点击图片放大全屏，支持左右滑动切换、双指缩放、点击关闭
 */
import { useState, useRef, useEffect, MouseEvent, TouchEvent, useCallback } from 'react';

interface ImageViewerProps {
  images: string[];             // 图片URL列表
  initialIndex?: number;        // 初始索引
  open: boolean;                // 是否打开
  onClose: () => void;          // 关闭回调
}

/**
 * 图片全屏预览组件
 */
export function ImageViewer({ images, initialIndex = 0, open, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [touchDistance, setTouchDistance] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 初始化索引
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setScale(1);
    }
  }, [open, initialIndex]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  // 上一张
  const prev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
    setScale(1);
  }, [images.length]);

  // 下一张
  const next = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
    setScale(1);
  }, [images.length]);

  // 点击遮罩关闭
  const handleMaskClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 触摸开始
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      // 双指距离
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      setTouchDistance(Math.sqrt(dx * dx + dy * dy));
    }
  };

  // 触摸移动
  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && touchStart) {
      // 单指滑动：记录结束位置
      setTouchEnd({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2 && touchDistance) {
      // 双指缩放
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / touchDistance;
      setScale(Math.max(0.5, Math.min(4, ratio)));
    }
  };

  // 触摸结束
  const handleTouchEnd = () => {
    if (touchStart && touchEnd && scale === 1) {
      // 单指滑动切换：计算水平位移
      const diff = touchEnd.x - touchStart.x;
      if (Math.abs(diff) > 50) {
        if (diff > 0) prev();
        else next();
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
    setTouchDistance(null);
  };

  if (!open || images.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black animate-fade-in"
      onClick={handleMaskClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-cream text-lg z-10"
        aria-label="关闭"
      >
        ✕
      </button>

      {/* 计数器 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 text-cream text-xs">
        {currentIndex + 1} / {images.length}
      </div>

      {/* 左箭头 */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-cream text-lg z-10"
          aria-label="上一张"
        >
          ‹
        </button>
      )}

      {/* 图片 */}
      <img
        src={images[currentIndex]}
        alt={`图片 ${currentIndex + 1}`}
        className="max-w-[90vw] max-h-[85vh] object-contain transition-transform duration-200 gpu-accelerated"
        style={{ transform: `scale(${scale})` }}
        draggable={false}
      />

      {/* 右箭头 */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-cream text-lg z-10"
          aria-label="下一张"
        >
          ›
        </button>
      )}

      {/* 缩放提示 */}
      {scale !== 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 text-cream text-xs">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
}
