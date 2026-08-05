/**
 * 移动端顶部标题栏
 * 适配 iOS 安全区、毛玻璃深墨绿背景
 */
import { useLocation } from 'react-router-dom';
import { useOfflineSync } from '@/hooks/useOfflineSync';

// ============ 路由名称映射 ============
const routeNames: Record<string, string> = {
  '/': '今日中枢',
  '/inspiration': '灵感补给站',
  '/wealth': '财富工坊',
  '/capsule': '时光胶囊',
  '/capsule/couple-logs': '情侣日志',
  '/capsule/memos': '备忘录',
  '/reminders': '智能提醒中心',
  '/settings': '设置',
};

interface MobileHeaderProps {
  onMenuClick: () => void;    // 汉堡菜单点击回调
}

/**
 * 移动端顶部标题栏组件
 */
export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const location = useLocation();
  const { status, isSyncing, isOffline } = useOfflineSync();

  // 获取当前页面名称
  const pageName = routeNames[location.pathname] || 'WorkBuddy';

  // 同步状态指示器
  const renderSyncIndicator = () => {
    if (isSyncing) {
      return (
        <span className="flex items-center gap-1 text-forest-light text-xs">
          <span className="inline-block w-3 h-3 border-2 border-forest-light border-t-transparent rounded-full animate-spin" />
          同步中
        </span>
      );
    }
    if (isOffline) {
      return (
        <span className="flex items-center gap-1 text-accent-red text-xs">
          <span className="w-2 h-2 rounded-full bg-accent-red" />
          离线
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-forest-light text-xs">
        <span className="w-2 h-2 rounded-full bg-forest-light" />
        已同步
      </span>
    );
  };

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 backdrop-blur-xl"
      style={{
        height: 'calc(52px + env(safe-area-inset-top))',
        paddingTop: 'env(safe-area-inset-top)',
        backgroundColor: 'rgba(26, 60, 42, 0.85)',
      }}
    >
      {/* 左侧汉堡菜单按钮 */}
      <button
        onClick={onMenuClick}
        className="flex items-center justify-center w-10 h-10 text-cream"
        aria-label="打开菜单"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
          {/* 像素风汉堡菜单 */}
          <rect x="3" y="5" width="18" height="2" fill="currentColor" />
          <rect x="3" y="11" width="14" height="2" fill="currentColor" />
          <rect x="3" y="17" width="18" height="2" fill="currentColor" />
        </svg>
      </button>

      {/* 中间页面标题 */}
      <h1 className="text-cream font-semibold text-base flex-1 text-center">
        {pageName}
      </h1>

      {/* 右侧同步状态指示器 */}
      <div className="flex items-center justify-end w-10">
        {renderSyncIndicator()}
      </div>
    </header>
  );
}
