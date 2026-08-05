/**
 * lunar-javascript 最小类型声明
 * 该包未自带 .d.ts，前端 tsc 构建需要此声明才能通过类型检查
 */
declare module 'lunar-javascript' {
  export class Solar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    toYmd(): string;
  }
  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar;
    getSolar(): Solar;
  }
}
