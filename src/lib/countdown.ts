/**
 * 倒数日计算工具
 * - 用户项：since(已过去) / until(还剩) / birthday(每年循环)
 * - 系统项：距离新年、距离下一个节日（公历固定 + 农历 lunar-javascript）
 */
import { Lunar } from 'lunar-javascript';
import type { CountdownMode } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 解析 YYYY-MM-DD 为本地日期（去掉时分秒） */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 今天（本地，归零时分） */
export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** 格式化为 YYYY-MM-DD */
export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** b - a 相差天数 */
export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** 已过去天数（今天 - 目标日） */
export function daysSince(target: string): number {
  return diffDays(parseDate(target), today());
}

/** 还剩天数（目标日 - 今天） */
export function daysUntil(target: string): number {
  return diffDays(today(), parseDate(target));
}

/** 下一个生日日期 */
export function nextBirthday(target: string): Date {
  const t = parseDate(target);
  const now = today();
  let next = new Date(now.getFullYear(), t.getMonth(), t.getDate());
  if (next.getTime() <= now.getTime()) {
    next = new Date(now.getFullYear() + 1, t.getMonth(), t.getDate());
  }
  return next;
}

/** 距离下次生日天数 */
export function daysToNextBirthday(target: string): number {
  return diffDays(today(), nextBirthday(target));
}

/** 距离下一个元旦 */
export function daysToNewYear(): number {
  const now = today();
  return diffDays(now, new Date(now.getFullYear() + 1, 0, 1));
}

// ============ 节日（公历固定 + 农历） ============
interface Festival {
  name: string;
  date: (year: number) => Date;
}

const gregorian = (m: number, d: number) => (year: number) => new Date(year, m - 1, d);

const lunar = (m: number, d: number) => (year: number): Date => {
  const ymd = Lunar.fromYmd(year, m, d).getSolar().toYmd(); // "YYYY-MM-DD"
  return parseDate(ymd);
};

const FESTIVALS: Festival[] = [
  { name: '元旦', date: gregorian(1, 1) },
  { name: '情人节', date: gregorian(2, 14) },
  { name: '劳动节', date: gregorian(5, 1) },
  { name: '儿童节', date: gregorian(6, 1) },
  { name: '国庆节', date: gregorian(10, 1) },
  { name: '平安夜', date: gregorian(12, 24) },
  { name: '圣诞节', date: gregorian(12, 25) },
  { name: '春节', date: lunar(1, 1) },
  { name: '元宵', date: lunar(1, 15) },
  { name: '端午', date: lunar(5, 5) },
  { name: '七夕', date: lunar(7, 7) },
  { name: '中元', date: lunar(7, 15) },
  { name: '中秋', date: lunar(8, 15) },
  { name: '重阳', date: lunar(9, 9) },
  { name: '腊八', date: lunar(12, 8) },
];

export interface NextFestival {
  name: string;
  days: number;
  date: string;
}

/** 距离下一个节日（今年+明年，取最近一个未到的） */
export function nextFestival(): NextFestival {
  const now = today();
  let best: { name: string; days: number; date: Date } | null = null;
  for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++) {
    for (const f of FESTIVALS) {
      const d = f.date(y);
      const diff = diffDays(now, d);
      if (diff >= 0 && (!best || diff < best.days)) {
        best = { name: f.name, days: diff, date: d };
      }
    }
  }
  if (!best) {
    const ny = new Date(now.getFullYear() + 1, 0, 1);
    return { name: '元旦', days: daysToNewYear(), date: fmtDate(ny) };
  }
  return { name: best.name, days: best.days, date: fmtDate(best.date) };
}

/** 计算一个 Countdown 的展示天数 */
export function computeCountdown(c: { mode: CountdownMode; target_date: string }): { days: number } {
  if (c.mode === 'since') return { days: daysSince(c.target_date) };
  if (c.mode === 'birthday') return { days: daysToNextBirthday(c.target_date) };
  return { days: daysUntil(c.target_date) };
}

/** 目标日期友好显示（生日显示 MM-DD 循环，其余显示 YYYY-MM-DD） */
export function targetDisplay(c: { mode: CountdownMode; target_date: string }): string {
  if (c.mode === 'birthday') {
    const d = parseDate(c.target_date);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}（每年）`;
  }
  return c.target_date;
}
