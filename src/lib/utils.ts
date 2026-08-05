/**
 * 通用工具函数
 * 包含日期处理、防抖节流、HTML 转义、文件处理等
 */
import { format, parseISO, differenceInDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// ============ 日期工具 ============

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

/** 格式化日期时间为 YYYY-MM-DD HH:mm */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd HH:mm');
}

/** 格式化友好时间（如"3小时前"） */
export function formatRelativeTime(date: string): string {
  const d = parseISO(date);
  const now = new Date();
  const diff = differenceInDays(now, d);
  if (diff === 0) return format(d, '今天 HH:mm');
  if (diff === 1) return '昨天';
  if (diff < 7) return `${diff}天前`;
  if (diff < 30) return format(d, 'MM月dd日');
  return format(d, 'yyyy年MM月dd日');
}

/** 获取当前日期字符串 */
export function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** 获取当前时间字符串 */
export function nowTime(): string {
  return format(new Date(), 'HH:mm');
}

// ============ HTML 转义（XSS 防护） ============

/**
 * HTML 转义用户输入内容，防止 XSS 攻击
 * 在渲染任何用户输入内容前调用
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ============ 防抖与节流 ============

/**
 * 防抖函数
 * 在连续调用停止后 delay 毫秒才执行一次
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 节流函数
 * 每 throttleMs 毫秒最多执行一次
 */
export function throttle<T extends (...args: any[]) => void>(fn: T, throttleMs: number): (...args: Parameters<T>) => void {
  let lastTime = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastTime >= throttleMs) {
      lastTime = now;
      fn(...args);
    }
  };
}

// ============ 文件处理 ============

/** 文件大小限制 */
export const MAX_FILE_SIZE = 200 * 1024; // 200KB

/** 允许的图片 MIME 类型 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * 图片魔数校验（防止伪装文件扩展名）
 * 检查文件头字节判断真实类型
 */
export function validateImageMagicNumber(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) return resolve(false);
      const bytes = new Uint8Array(buffer);
      // JPEG: FF D8 FF
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return resolve(true);
      // PNG: 89 50 4E 47
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return resolve(true);
      // GIF: 47 49 46 38
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return resolve(true);
      // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
          bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return resolve(true);
      resolve(false);
    };
    reader.onerror = () => resolve(false);
    // 只读前 12 字节
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
}

/**
 * 压缩图片为 WebP 格式
 * 目标：单张 ≤ 200KB
 */
export async function compressImage(file: File, maxSize: number = MAX_FILE_SIZE): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // 等比缩放，最大宽度 1280
        const MAX_WIDTH = 1280;
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // 逐步降低质量直到 ≤ maxSize
        let quality = 0.85;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('压缩失败'));
              if (blob.size <= maxSize || quality <= 0.3) {
                resolve(blob);
              } else {
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/webp',
            quality
          );
        };
        tryCompress();
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 生成 UUID v4
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============ 农历转换 ============

/**
 * 农历日期转公历日期
 * 使用 lunar-javascript 库
 */
export function lunarToSolar(lunarDate: string): string {
  try {
    // 动态导入避免首次加载过大
    const { Lunar } = require('lunar-javascript');
    const [year, month, day] = lunarDate.split('-').map(Number);
    const lunar = Lunar.fromYmd(year, month, day);
    const solar = lunar.getSolar();
    return `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`;
  } catch (e) {
    console.error('[Lunar] 农历转换失败', e);
    return lunarDate;
  }
}

/**
 * 公历日期转农历日期
 */
export function solarToLunar(solarDate: string): string {
  try {
    const { Solar } = require('lunar-javascript');
    const [year, month, day] = solarDate.split('-').map(Number);
    const solar = Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    return `${lunar.getYear()}-${lunar.getMonth()}-${lunar.getDay()}`;
  } catch (e) {
    console.error('[Lunar] 公历转农历失败', e);
    return solarDate;
  }
}

// ============ 杂项 ============

/** 生成随机颜色（用于图表） */
export function randomColor(): string {
  const colors = ['#5A7A4A', '#7DBF8A', '#C4A882', '#D64550', '#E8A87C', '#F0D58C', '#A8BBA0', '#2D5A3D'];
  return colors[Math.floor(Math.random() * colors.length)];
}

/** 将金额（分）转为显示文本 */
export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 将金额文本转为分 */
export function parseAmount(text: string): number {
  return Math.round(parseFloat(text) * 100);
}

/** 判断当前是否移动端 */
export function isMobile(): boolean {
  return window.innerWidth <= 768;
}

/** 安全的 JSON 解析 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
