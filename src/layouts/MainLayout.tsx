/**
 * 主布局组件
 * PC 端：左侧 Sidebar + 右侧内容区
 * 移动端：顶部 MobileHeader + MobileDrawer + 内容区
 */
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { MobileDrawer } from './MobileDrawer';

// 侧边栏宽度常量
const SIDEBAR_WIDTH = 200;
const SIDEBAR_COLLAPSED_WIDTH = 72;

/**
 * 主布局组件
 * 根据屏幕宽度自适应切换 PC / 移动端布局
 */
export function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测屏幕宽度
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 计算内容区左边距
  const marginLeft = isMobile ? 0 : (sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH);

  return (
    <div className="min-h-screen bg-cream dark:bg-forest-dark">
      {/* PC 端侧边栏 */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 移动端顶部标题栏 */}
      {isMobile && (
        <MobileHeader onMenuClick={() => setDrawerOpen(true)} />
      )}

      {/* 移动端抽屉导航 */}
      {isMobile && (
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onOpen={() => setDrawerOpen(true)}
        />
      )}

      {/* 主内容区 */}
      <main
        className="min-h-screen transition-all duration-300"
        style={{
          marginLeft,
          // 移动端留出顶部标题栏高度
          paddingTop: isMobile ? 'calc(52px + env(safe-area-inset-top))' : 0,
          // 底部安全区
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
