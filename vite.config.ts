/**
 * Vite 构建配置
 * 集成 React 插件 + PWA 插件 + 路径别名
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { barkDevApiPlugin } from './plugins/bark-dev-api';

export default defineConfig({
  plugins: [
    react(),
    // 本地 Bark 推送 API（仅 dev，免部署 Vercel 即可测试推送）
    barkDevApiPlugin(),
    // PWA 配置：Service Worker 自动生成，离线缓存策略
    VitePWA({
      registerType: 'prompt', // 新版本弹出提示让用户确认刷新
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'WorkBuddy 个人工作台',
        short_name: 'WorkBuddy',
        description: '像素森系个人工作台 - 待办、记账、情侣日志、备忘录、智能提醒',
        theme_color: '#1A3C2A',
        background_color: '#FDF8EC',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        // iOS 主屏幕图标配置
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        // iOS 特定配置
        apple_touch_icon: '/icons/icon-180.png',
      },
      workbox: {
        // 预缓存清单
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 运行时缓存策略
        runtimeCaching: [
          {
            // Supabase API 请求：网络优先，超时回退缓存
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Supabase Storage 图片：缓存优先
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 2592000 },
            },
          },
          {
            // 静态资源：过期时重新验证
            urlPattern: /\.(?:js|css|woff2?|ttf)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: { maxEntries: 200, maxAgeSeconds: 2592000 },
            },
          },
        ],
      },
      // 开发环境禁用 PWA
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'chart-vendor': ['recharts'],
          'utils-vendor': ['date-fns', 'jszip', 'lunar-javascript'],
        },
      },
    },
    // 压缩配置
    minify: 'esbuild',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500,
  },
  // CSS 预处理器
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 3000,
    // 同时监听 IPv4 和 IPv6，兼容 Windows 默认仅监听 IPv6 的问题
    host: true,
    strictPort: false,
    // 代理配置
    proxy: {
      // ⭐ Supabase 反向代理：浏览器→Vite→Supabase
      // 解决浏览器侧 "Failed to fetch" 错误（扩展/代理拦截）
      // 所有 https://*.supabase.co/* 请求改走 /__supabase/* 由 Vite 转发
      '/__supabase': {
        target: 'https://vidpnamyhxqaghakbzvf.supabase.co',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/__supabase/, ''),
        ws: true,
        // 长连接场景下保持连接
        headers: {
          Connection: 'keep-alive',
        },
      },
    },
  },
});
