/**
 * 路由配置
 * 使用 createBrowserRouter，懒加载 + Suspense + 路由守卫
 */
import { lazy, Suspense, ReactNode } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { MainLayout } from '@/layouts/MainLayout';
import { Loading } from '@/components/ui/Loading';

// ============ 懒加载页面 ============
const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Inspiration = lazy(() => import('@/pages/Inspiration'));
const Wealth = lazy(() => import('@/pages/Wealth'));
const TimeCapsule = lazy(() => import('@/pages/TimeCapsule'));
const Reminders = lazy(() => import('@/pages/Reminders'));
const Settings = lazy(() => import('@/pages/Settings'));

// ============ 懒加载包裹组件 ============
/**
 * Suspense 懒加载包裹器
 * 加载中显示像素风 Loading
 */
function LazyLoad({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading fullscreen text="加载中..." />}>
      {children}
    </Suspense>
  );
}

// ============ 路由守卫 ============
/**
 * 路由守卫组件
 * 未登录跳转 /login
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, initialized } = useAuthStore();

  // 初始化未完成时显示加载
  if (!initialized) {
    return <Loading fullscreen text="正在初始化..." />;
  }

  // 未登录跳转登录页
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// ============ 路由配置 ============
const router = createBrowserRouter([
  {
    // 登录页（无需守卫）
    path: '/login',
    element: (
      <LazyLoad>
        <Login />
      </LazyLoad>
    ),
  },
  {
    // 受保护路由（需登录）
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      // 今日中枢
      {
        index: true,
        element: (
          <LazyLoad>
            <Dashboard />
          </LazyLoad>
        ),
      },
      // 灵感补给站
      {
        path: 'inspiration',
        element: (
          <LazyLoad>
            <Inspiration />
          </LazyLoad>
        ),
      },
      // 财富工坊
      {
        path: 'wealth',
        element: (
          <LazyLoad>
            <Wealth />
          </LazyLoad>
        ),
      },
      // 时光胶囊（Tab 内部切换情侣日志/备忘录）
      {
        path: 'capsule',
        element: (
          <LazyLoad>
            <TimeCapsule />
          </LazyLoad>
        ),
      },
      // 智能提醒中心
      {
        path: 'reminders',
        element: (
          <LazyLoad>
            <Reminders />
          </LazyLoad>
        ),
      },
      // 设置
      {
        path: 'settings',
        element: (
          <LazyLoad>
            <Settings />
          </LazyLoad>
        ),
      },
    ],
  },
  // 未匹配路由重定向到首页
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

/**
 * App 根组件
 * 渲染路由 + PWA 更新提示 + 全局 Toast
 */
export function AppRoutes() {
  return <RouterProvider router={router} />;
}

// 默认导出路由组件（供 main.tsx 使用）
export default AppRoutes;
