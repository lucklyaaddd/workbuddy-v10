/**
 * 像素风格 SVG 图标组件库
 * 用 SVG 绘制像素风图标，每个图标接收 size、color 参数
 */
import { CSSProperties } from 'react';

// ============ 公共类型 ============
interface PixelIconProps {
  size?: number;               // 图标尺寸（像素）
  color?: string;              // 主色
  className?: string;          // 附加类名
  style?: CSSProperties;       // 附加样式
}

// 默认尺寸
const DEFAULT_SIZE = 24;

/**
 * 像素苹果（红色）
 */
export function PixelApple({ size = DEFAULT_SIZE, color = '#D64550', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 苹果叶子（绿色） */}
      <rect x="8" y="1" width="2" height="1" fill="#7DBF8A" />
      <rect x="9" y="2" width="1" height="1" fill="#5A7A4A" />
      {/* 苹果主体 */}
      <rect x="3" y="4" width="10" height="1" fill={color} />
      <rect x="2" y="5" width="12" height="1" fill={color} />
      <rect x="2" y="6" width="12" height="4" fill={color} />
      <rect x="3" y="10" width="10" height="1" fill={color} />
      <rect x="5" y="11" width="6" height="1" fill={color} />
      <rect x="6" y="12" width="4" height="1" fill={color} />
      {/* 高光 */}
      <rect x="4" y="6" width="1" height="2" fill="#E88080" />
      <rect x="5" y="6" width="1" height="1" fill="#E88080" />
    </svg>
  );
}

/**
 * 像素叶片（绿色）
 */
export function PixelLeaf({ size = DEFAULT_SIZE, color = '#7DBF8A', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 叶片主体 */}
      <rect x="7" y="2" width="2" height="1" fill={color} />
      <rect x="6" y="3" width="4" height="1" fill={color} />
      <rect x="5" y="4" width="6" height="1" fill={color} />
      <rect x="4" y="5" width="8" height="1" fill={color} />
      <rect x="4" y="6" width="8" height="2" fill={color} />
      <rect x="5" y="8" width="6" height="1" fill={color} />
      <rect x="6" y="9" width="4" height="1" fill={color} />
      <rect x="7" y="10" width="2" height="1" fill={color} />
      {/* 叶脉 */}
      <rect x="7" y="4" width="1" height="6" fill="#5A7A4A" />
      <rect x="5" y="6" width="1" height="1" fill="#5A7A4A" />
      <rect x="10" y="6" width="1" height="1" fill="#5A7A4A" />
    </svg>
  );
}

/**
 * 像素花朵
 */
export function PixelFlower({ size = DEFAULT_SIZE, color = '#D64550', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 花瓣（四个方向） */}
      <rect x="7" y="2" width="2" height="3" fill={color} />
      <rect x="7" y="11" width="2" height="3" fill={color} />
      <rect x="2" y="7" width="3" height="2" fill={color} />
      <rect x="11" y="7" width="3" height="2" fill={color} />
      {/* 对角花瓣 */}
      <rect x="4" y="4" width="2" height="2" fill={color} opacity="0.8" />
      <rect x="10" y="4" width="2" height="2" fill={color} opacity="0.8" />
      <rect x="4" y="10" width="2" height="2" fill={color} opacity="0.8" />
      <rect x="10" y="10" width="2" height="2" fill={color} opacity="0.8" />
      {/* 花蕊（黄色） */}
      <rect x="6" y="6" width="4" height="4" fill="#F0D58C" />
      <rect x="7" y="7" width="2" height="2" fill="#E8A87C" />
    </svg>
  );
}

/**
 * 像素日记本
 */
export function PixelBook({ size = DEFAULT_SIZE, color = '#C4A882', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 书本封面 */}
      <rect x="2" y="2" width="12" height="12" fill={color} />
      <rect x="2" y="2" width="12" height="1" fill="#9B7D5A" />
      <rect x="2" y="13" width="12" height="1" fill="#9B7D5A" />
      {/* 书脊 */}
      <rect x="2" y="2" width="1" height="12" fill="#9B7D5A" />
      {/* 页面线 */}
      <rect x="4" y="5" width="8" height="1" fill="#FDF8EC" />
      <rect x="4" y="7" width="8" height="1" fill="#FDF8EC" />
      <rect x="4" y="9" width="6" height="1" fill="#FDF8EC" />
      <rect x="4" y="11" width="4" height="1" fill="#FDF8EC" />
    </svg>
  );
}

/**
 * 像素金币
 */
export function PixelCoin({ size = DEFAULT_SIZE, color = '#F0D58C', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 金币外圈 */}
      <rect x="4" y="2" width="8" height="1" fill={color} />
      <rect x="3" y="3" width="10" height="1" fill={color} />
      <rect x="2" y="4" width="12" height="8" fill={color} />
      <rect x="3" y="12" width="10" height="1" fill={color} />
      <rect x="4" y="13" width="8" height="1" fill={color} />
      {/* 金币内圈（深色边） */}
      <rect x="4" y="3" width="8" height="1" fill="#E8A87C" />
      <rect x="3" y="4" width="1" height="8" fill="#E8A87C" />
      <rect x="12" y="4" width="1" height="8" fill="#E8A87C" />
      {/* 中心 ¥ 符号 */}
      <rect x="7" y="5" width="2" height="1" fill="#9B7D5A" />
      <rect x="6" y="6" width="4" height="1" fill="#9B7D5A" />
      <rect x="7" y="7" width="2" height="3" fill="#9B7D5A" />
      <rect x="6" y="9" width="1" height="1" fill="#9B7D5A" />
      <rect x="9" y="9" width="1" height="1" fill="#9B7D5A" />
    </svg>
  );
}

/**
 * 像素铃铛
 */
export function PixelBell({ size = DEFAULT_SIZE, color = '#F0D58C', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 铃铛顶部挂钩 */}
      <rect x="7" y="1" width="2" height="1" fill="#9B7D5A" />
      {/* 铃铛主体 */}
      <rect x="6" y="2" width="4" height="1" fill={color} />
      <rect x="5" y="3" width="6" height="1" fill={color} />
      <rect x="4" y="4" width="8" height="1" fill={color} />
      <rect x="3" y="5" width="10" height="5" fill={color} />
      <rect x="4" y="10" width="8" height="1" fill={color} />
      <rect x="5" y="11" width="6" height="1" fill={color} />
      {/* 底部铃舌 */}
      <rect x="7" y="12" width="2" height="2" fill="#9B7D5A" />
      {/* 高光 */}
      <rect x="5" y="6" width="1" height="3" fill="#FDF8EC" opacity="0.6" />
    </svg>
  );
}

/**
 * 像素齿轮
 */
export function PixelGear({ size = DEFAULT_SIZE, color = '#C4A882', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 齿轮齿（八个方向） */}
      <rect x="7" y="1" width="2" height="2" fill={color} />
      <rect x="7" y="13" width="2" height="2" fill={color} />
      <rect x="1" y="7" width="2" height="2" fill={color} />
      <rect x="13" y="7" width="2" height="2" fill={color} />
      <rect x="3" y="3" width="2" height="2" fill={color} />
      <rect x="11" y="3" width="2" height="2" fill={color} />
      <rect x="3" y="11" width="2" height="2" fill={color} />
      <rect x="11" y="11" width="2" height="2" fill={color} />
      {/* 齿轮主体 */}
      <rect x="5" y="5" width="6" height="6" fill={color} />
      <rect x="4" y="6" width="1" height="4" fill={color} />
      <rect x="11" y="6" width="1" height="4" fill={color} />
      <rect x="6" y="4" width="4" height="1" fill={color} />
      <rect x="6" y="11" width="4" height="1" fill={color} />
      {/* 中心孔 */}
      <rect x="7" y="7" width="2" height="2" fill="#FDF8EC" />
    </svg>
  );
}

/**
 * 线条小狗
 */
export function PixelDog({ size = DEFAULT_SIZE, color = '#5A7A4A', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 小狗头部 */}
      <rect x="9" y="5" width="4" height="1" fill={color} />
      <rect x="8" y="6" width="6" height="4" fill={color} />
      <rect x="9" y="10" width="4" height="1" fill={color} />
      {/* 耳朵 */}
      <rect x="8" y="4" width="1" height="2" fill={color} />
      <rect x="12" y="4" width="1" height="2" fill={color} />
      {/* 眼睛 */}
      <rect x="10" y="7" width="1" height="1" fill="#1A3C2A" />
      <rect x="12" y="7" width="1" height="1" fill="#1A3C2A" />
      {/* 鼻子 */}
      <rect x="11" y="9" width="1" height="1" fill="#1A3C2A" />
      {/* 身体 */}
      <rect x="2" y="6" width="6" height="1" fill={color} />
      <rect x="1" y="7" width="7" height="4" fill={color} />
      <rect x="2" y="11" width="6" height="1" fill={color} />
      {/* 腿 */}
      <rect x="2" y="12" width="1" height="2" fill={color} />
      <rect x="6" y="12" width="1" height="2" fill={color} />
      {/* 尾巴 */}
      <rect x="0" y="5" width="1" height="3" fill={color} />
    </svg>
  );
}

/**
 * 像素心形
 */
export function PixelHeart({ size = DEFAULT_SIZE, color = '#D64550', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 心形上半部分 */}
      <rect x="3" y="3" width="3" height="1" fill={color} />
      <rect x="10" y="3" width="3" height="1" fill={color} />
      <rect x="2" y="4" width="5" height="1" fill={color} />
      <rect x="9" y="4" width="5" height="1" fill={color} />
      <rect x="2" y="5" width="12" height="1" fill={color} />
      <rect x="3" y="6" width="10" height="2" fill={color} />
      {/* 心形下半部分 */}
      <rect x="4" y="8" width="8" height="1" fill={color} />
      <rect x="5" y="9" width="6" height="1" fill={color} />
      <rect x="6" y="10" width="4" height="1" fill={color} />
      <rect x="7" y="11" width="2" height="1" fill={color} />
      {/* 高光 */}
      <rect x="4" y="5" width="1" height="1" fill="#E88080" />
      <rect x="4" y="6" width="1" height="1" fill="#E88080" />
    </svg>
  );
}

/**
 * 像素房子（今日中枢）
 */
export function PixelHouse({ size = DEFAULT_SIZE, color = '#5A7A4A', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 屋顶 */}
      <rect x="7" y="1" width="2" height="1" fill={color} />
      <rect x="5" y="2" width="6" height="1" fill={color} />
      <rect x="3" y="3" width="10" height="1" fill={color} />
      <rect x="1" y="4" width="14" height="1" fill={color} />
      {/* 墙体 */}
      <rect x="2" y="5" width="12" height="8" fill="#C4A882" />
      <rect x="2" y="5" width="1" height="8" fill="#9B7D5A" />
      <rect x="13" y="5" width="1" height="8" fill="#9B7D5A" />
      <rect x="2" y="13" width="12" height="1" fill="#9B7D5A" />
      {/* 门 */}
      <rect x="6" y="9" width="4" height="4" fill="#9B7D5A" />
      <rect x="7" y="10" width="2" height="3" fill="#5A7A4A" />
      {/* 窗户 */}
      <rect x="4" y="7" width="2" height="2" fill="#7DBF8A" />
      <rect x="10" y="7" width="2" height="2" fill="#7DBF8A" />
    </svg>
  );
}

/**
 * 像素时钟（提醒中心）
 */
export function PixelClock({ size = DEFAULT_SIZE, color = '#5A7A4A', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 时钟外圈 */}
      <rect x="5" y="1" width="6" height="1" fill={color} />
      <rect x="3" y="2" width="10" height="1" fill={color} />
      <rect x="2" y="3" width="12" height="1" fill={color} />
      <rect x="1" y="4" width="14" height="8" fill={color} />
      <rect x="2" y="12" width="12" height="1" fill={color} />
      <rect x="3" y="13" width="10" height="1" fill={color} />
      <rect x="5" y="14" width="6" height="1" fill={color} />
      {/* 表盘 */}
      <rect x="3" y="4" width="10" height="8" fill="#FDF8EC" />
      {/* 时针和分针 */}
      <rect x="7" y="5" width="2" height="3" fill="#5A7A4A" />
      <rect x="8" y="8" width="3" height="1" fill="#D64550" />
      <rect x="7" y="7" width="1" height="1" fill="#5A7A4A" />
    </svg>
  );
}

/**
 * 像素碗盛菜（私厨菜谱）
 */
export function PixelRecipe({ size = DEFAULT_SIZE, color = '#C4A882', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 蒸汽 */}
      <rect x="6" y="2" width="1" height="2" fill="#FDF8EC" />
      <rect x="9" y="1" width="1" height="2" fill="#FDF8EC" />
      {/* 碗里的菜（绿/红/橙） */}
      <rect x="5" y="7" width="2" height="2" fill="#7DBF8A" />
      <rect x="8" y="6" width="2" height="2" fill="#D64550" />
      <rect x="10" y="8" width="2" height="1" fill="#E8A87C" />
      {/* 碗主体 */}
      <rect x="3" y="9" width="10" height="1" fill={color} />
      <rect x="2" y="10" width="12" height="3" fill={color} />
      <rect x="2" y="10" width="1" height="3" fill="#9B7D5A" />
      <rect x="13" y="10" width="1" height="3" fill="#9B7D5A" />
      <rect x="3" y="13" width="10" height="1" fill="#9B7D5A" />
    </svg>
  );
}

/**
 * 像素日历（倒数日）
 */
export function PixelCountdown({ size = DEFAULT_SIZE, color = '#C4A882', className = '', style }: PixelIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} style={style} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      {/* 顶部装订环 */}
      <rect x="4" y="1" width="1" height="2" fill="#9B7D5A" />
      <rect x="11" y="1" width="1" height="2" fill="#9B7D5A" />
      {/* 日历头部 */}
      <rect x="2" y="3" width="12" height="2" fill={color} />
      <rect x="2" y="3" width="12" height="1" fill="#9B7D5A" />
      {/* 日历体 */}
      <rect x="2" y="5" width="12" height="9" fill="#FDF8EC" />
      <rect x="2" y="5" width="1" height="9" fill={color} />
      <rect x="13" y="5" width="1" height="9" fill={color} />
      {/* 网格线 */}
      <rect x="6" y="5" width="1" height="9" fill="#C4A882" opacity="0.4" />
      <rect x="10" y="5" width="1" height="9" fill="#C4A882" opacity="0.4" />
      <rect x="2" y="8" width="12" height="1" fill="#C4A882" opacity="0.4" />
      <rect x="2" y="11" width="12" height="1" fill="#C4A882" opacity="0.4" />
      {/* 中心标记（森系绿，示意「天数」） */}
      <rect x="7" y="6" width="2" height="1" fill="#5A7A4A" />
      <rect x="7" y="9" width="2" height="1" fill="#5A7A4A" />
    </svg>
  );
}
