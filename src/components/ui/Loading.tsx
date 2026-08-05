/**
 * 加载动画组件
 * 像素风格的旋转加载动画
 */
interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';   // 尺寸
  text?: string;               // 加载文字
  fullscreen?: boolean;        // 是否全屏覆盖
}

// 尺寸映射（像素）
const sizeMap = {
  sm: { spinner: 24, border: 4 },
  md: { spinner: 40, border: 6 },
  lg: { spinner: 56, border: 8 },
};

/**
 * 加载动画组件
 * 使用像素风格的旋转方块组合
 */
export function Loading({ size = 'md', text, fullscreen = false }: LoadingProps) {
  const { spinner, border } = sizeMap[size];

  // 全屏覆盖
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-cream/80 dark:bg-forest-dark/80 backdrop-blur-sm">
        <PixelSpinner size={spinner} border={border} />
        {text && <p className="mt-4 text-sm text-secondary animate-pulse">{text}</p>}
      </div>
    );
  }

  // 行内加载
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <PixelSpinner size={spinner} border={border} />
      {text && <p className="mt-3 text-xs text-secondary animate-pulse">{text}</p>}
    </div>
  );
}

/**
 * 像素风旋转动画
 * 四个方块交替闪烁，营造像素感
 */
function PixelSpinner({ size, border }: { size: number; border: number }) {
  return (
    <div
      className="relative animate-spin"
      style={{ width: size, height: size }}
    >
      {/* 外圈：像素风方块组成的圆 */}
      <div
        className="rounded-full border-forest border-t-forest-light"
        style={{ borderWidth: border }}
      />
      {/* 中心像素小点 */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-forest-light animate-pixel-blink"
        style={{ width: Math.max(4, size / 6), height: Math.max(4, size / 6) }}
      />
    </div>
  );
}
