/**
 * App 根组件
 * 包含路由、PWA 更新提示、全局 Toast 容器
 */
import { AppRoutes } from '@/router';
import { ToastContainer } from '@/components/ui/Toast';
import { PWAUpdatePrompt } from '@/components/ui/PWAUpdatePrompt';

/**
 * App 根组件
 */
export default function App() {
  return (
    <>
      {/* 路由配置 */}
      <AppRoutes />

      {/* 全局 Toast 通知容器 */}
      <ToastContainer />

      {/* PWA 更新提示 */}
      <PWAUpdatePrompt />
    </>
  );
}
