/**
 * 装饰元素组件
 * 像素森系风格的装饰组件，用于卡片角落、空状态、加载页等
 */
import { CSSProperties } from 'react';

// ============ 公共类型 ============
interface DecorationProps {
  className?: string;          // 附加类名
  style?: CSSProperties;       // 附加样式
  opacity?: number;             // 透明度
}

/**
 * 波点背景图案
 * 使用 CSS radial-gradient 实现波点纹理
 */
export function DottedPattern({ className = '', style, opacity = 0.15 }: DecorationProps) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        backgroundImage: 'radial-gradient(circle, #C4A882 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        opacity,
        ...style,
      }}
    />
  );
}

/**
 * 像素小草装饰
 * 用 SVG 绘制的小草丛
 */
export function PixelGrass({ className = '', style, opacity = 0.2 }: DecorationProps) {
  return (
    <svg
      className={`absolute pointer-events-none ${className}`}
      style={{ opacity, ...style }}
      width="60"
      height="30"
      viewBox="0 0 60 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
    >
      {/* 左侧草叶 */}
      <rect x="2" y="18" width="2" height="10" fill="#5A7A4A" />
      <rect x="1" y="14" width="2" height="6" fill="#7DBF8A" />
      <rect x="5" y="20" width="2" height="8" fill="#5A7A4A" />
      <rect x="4" y="16" width="2" height="6" fill="#7DBF8A" />
      {/* 中间草叶 */}
      <rect x="14" y="18" width="2" height="10" fill="#5A7A4A" />
      <rect x="13" y="12" width="2" height="8" fill="#7DBF8A" />
      <rect x="17" y="20" width="2" height="8" fill="#5A7A4A" />
      <rect x="16" y="16" width="2" height="6" fill="#7DBF8A" />
      <rect x="20" y="22" width="2" height="6" fill="#5A7A4A" />
      {/* 右侧草叶 */}
      <rect x="28" y="18" width="2" height="10" fill="#5A7A4A" />
      <rect x="27" y="14" width="2" height="6" fill="#7DBF8A" />
      <rect x="31" y="20" width="2" height="8" fill="#5A7A4A" />
      <rect x="30" y="16" width="2" height="6" fill="#7DBF8A" />
      {/* 地面线 */}
      <rect x="0" y="28" width="60" height="2" fill="#9B7D5A" opacity="0.3" />
    </svg>
  );
}

/**
 * 线条小狗装饰
 * 简约线条风格的小狗
 */
export function PixelDogLine({ className = '', style, opacity = 0.12 }: DecorationProps) {
  return (
    <svg
      className={`absolute pointer-events-none ${className}`}
      style={{ opacity, ...style }}
      width="80"
      height="60"
      viewBox="0 0 80 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 身体轮廓 */}
      <path
        d="M10 35 Q10 25 20 23 L48 23 Q58 23 58 33 L58 45 Q58 50 54 50 L50 50 L48 45 L20 45 L18 50 L14 50 Q10 50 10 45 Z"
        stroke="#5A7A4A"
        strokeWidth="1.5"
        fill="none"
      />
      {/* 头部 */}
      <ellipse cx="58" cy="30" rx="8" ry="7" stroke="#5A7A4A" strokeWidth="1.5" fill="none" />
      {/* 耳朵 */}
      <path d="M53 24 L51 18 L55 21" stroke="#5A7A4A" strokeWidth="1.5" fill="none" />
      <path d="M63 24 L65 18 L61 21" stroke="#5A7A4A" strokeWidth="1.5" fill="none" />
      {/* 眼睛 */}
      <circle cx="56" cy="29" r="1.2" fill="#5A7A4A" />
      <circle cx="60" cy="29" r="1.2" fill="#5A7A4A" />
      {/* 鼻子 */}
      <ellipse cx="58" cy="33" rx="1" ry="0.8" fill="#5A7A4A" />
      {/* 尾巴 */}
      <path d="M10 35 Q4 33 6 27 Q7 24 10 25" stroke="#5A7A4A" strokeWidth="1.5" fill="none" />
      {/* 腿 */}
      <line x1="22" y1="50" x2="22" y2="56" stroke="#5A7A4A" strokeWidth="1.5" />
      <line x1="46" y1="50" x2="46" y2="56" stroke="#5A7A4A" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * 叶片纹理背景
 * 使用 SVG 图案做背景纹理
 */
export function LeafTexture({ className = '', style, opacity = 0.06 }: DecorationProps) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M20 5 Q15 10 15 20 Q15 30 20 35 Q25 30 25 20 Q25 10 20 5' fill='%237DBF8A' opacity='1'/%3E%3C/svg%3E")`,
        backgroundSize: '40px 40px',
        opacity,
        ...style,
      }}
    />
  );
}

/**
 * 组合装饰组件
 * 用于卡片角落装饰，包含小草和波点
 */
export function CornerDecoration({ className = '', style }: DecorationProps) {
  return (
    <div className={`absolute pointer-events-none ${className}`} style={style}>
      <DottedPattern opacity={0.1} />
      <PixelGrass className="bottom-0 left-0" opacity={0.25} />
    </div>
  );
}
