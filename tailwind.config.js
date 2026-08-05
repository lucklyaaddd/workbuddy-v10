/**
 * TailwindCSS 配置
 * 像素森系主题色板 + 深色/浅色模式 + 自定义动画
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class', // 深色模式由 class 控制
  theme: {
    extend: {
      colors: {
        // 主色系：苔藓绿 + 奶油米黄（占比 60%）
        forest: {
          DEFAULT: '#5A7A4A', // 主苔藓绿
          dark: '#1A3C2A',    // 深墨绿（导航栏背景）
          mid: '#2D5A3D',     // 中绿（辅助色）
          light: '#7DBF8A',   // 高亮绿
          sage: '#A8BBA0',    // 鼠尾草绿
        },
        cream: {
          DEFAULT: '#FDF8EC', // 奶油米黄（背景主色）
          dark: '#F5EDD6',    // 深米黄
        },
        // 辅助色系：橡木棕（占比 30%）
        oak: {
          DEFAULT: '#C4A882',
          dark: '#9B7D5A',
        },
        // 强调色系（占比 10%）
        accent: {
          red: '#D64550',     // 像素红
          orange: '#E8A87C',  // 暖橙
          honey: '#F0D58C',   // 蜂蜜黄
        },
        // 文字色
        ink: {
          dark: '#3D2C1B',    // 深棕（浅色模式文字）
          light: '#FDF8EC',   // 米白（深色模式文字）
        },
        // 次要文字色（使用 CSS 变量，自动适配深色模式）
        secondary: 'var(--text-secondary)',
      },
      fontFamily: {
        // 像素风格字体用于标题/图标，正文用系统字体
        pixel: ['"Press Start 2P"', 'monospace'],
        body: ['"PingFang SC"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        // 手绘叶片纹理
        'leaf-texture': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M20 5 Q15 10 15 20 Q15 30 20 35 Q25 30 25 20 Q25 10 20 5' fill='%237DBF8A' opacity='0.08'/%3E%3C/svg%3E\")",
      },
      animation: {
        'slide-in-left': 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'bounce-gentle': 'bounceGentle 2s ease-in-out infinite',
        'pixel-blink': 'pixelBlink 1s steps(2) infinite',
      },
      keyframes: {
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        pixelBlink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.3 },
        },
      },
    },
  },
  plugins: [],
};
