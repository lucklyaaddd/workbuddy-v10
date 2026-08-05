/**
 * 移动端左侧抽屉导航
 * 从左侧滑入，硬件加速 transform，支持左边缘滑动唤出
 */
import { useEffect, useRef, useState, MouseEvent as ReactMouseEvent } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  PixelHouse,
  PixelBook,
  PixelCoin,
  PixelHeart,
  PixelClock,
  PixelGear,
} from '@/components/pixel/PixelIcons';
import { DottedPattern, PixelGrass, PixelDogLine, LeafTexture } from '@/components/pixel/Decorations';

// ============ 导航菜单项配置 ============
interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const navItems: NavItem[] = [
  { to: '/', label: '今日中枢', icon: PixelHouse },
  { to: '/inspiration', label: '灵感补给站', icon: PixelBook },
  { to: '/wealth', label: '财富工坊', icon: PixelCoin },
  { to: '/capsule', label: '时光胶囊', icon: PixelHeart },
  { to: '/reminders', label: '智能提醒中心', icon: PixelClock },
  { to: '/settings', label: '设置', icon: PixelGear },
];

interface MobileDrawerProps {
  open: boolean;              // 是否打开
  onClose: () => void;        // 关闭回调
  onOpen: () => void;          // 打开回调（边缘滑动时触发）
}

/**
 * 移动端抽屉导航组件
 */
export function MobileDrawer({ open, onClose, onOpen }: MobileDrawerProps) {
  const navigate = useNavigate();
  const [startX, setStartX] = useState<number | null>(null);
  const [edgeSwiping, setEdgeSwiping] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 监听左边缘滑动（使用原生 DOM 事件）
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return;
      // 仅在左边缘 20px 范围内触发
      if (touch.clientX < 20 && !open) {
        setStartX(touch.clientX);
        setEdgeSwiping(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!edgeSwiping || startX === null) return;
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return;
      const diff = touch.clientX - startX;
      // 滑动超过 50px 唤出
      if (diff > 50) {
        onOpen();
        setEdgeSwiping(false);
        setStartX(null);
      }
    };

    const handleTouchEnd = () => {
      setEdgeSwiping(false);
      setStartX(null);
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [edgeSwiping, startX, open, onOpen]);

  // 点击遮罩关闭
  const handleMaskClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 菜单项点击
  const handleNavClick = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <>
      {/* 遮罩层 */}
      {open && (
        <div
          ref={overlayRef}
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={handleMaskClick}
        />
      )}

      {/* 抽屉主体 */}
      <aside
        className="md:hidden fixed top-0 bottom-0 left-0 z-50 flex flex-col transition-transform duration-300 gpu-accelerated"
        style={{
          width: '75%',
          maxWidth: '300px',
          backgroundColor: '#1A3C2A',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* 叶片纹理背景 */}
        <LeafTexture opacity={0.05} />
        {/* 波点装饰 */}
        <DottedPattern opacity={0.04} className="top-0 left-0 right-0 h-40" />
        {/* 线条小狗装饰 */}
        <PixelDogLine className="bottom-24 right-2" opacity={0.08} />

        {/* iOS 安全区顶部填充 */}
        <div style={{ height: 'env(safe-area-inset-top)' }} />

        {/* 顶部 Logo */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-forest-light/15">
          <div className="text-2xl">🍎</div>
          <div>
            <h1 className="text-cream font-bold text-sm">WorkBuddy</h1>
            <p className="text-forest-light text-[10px]">个人工作台</p>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 py-3 overflow-y-auto custom-scroll">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => handleNavClick(item.to)}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* 像素小草装饰 */}
        <PixelGrass className="bottom-16 left-2" opacity={0.15} />

        {/* 底部品牌标语 */}
        <div
          className="px-5 py-4 border-t border-forest-light/15"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        >
          <p className="text-forest-light text-[10px] leading-relaxed">
            🌿 天地通，年月通
          </p>
          <p className="text-forest-light text-[10px] leading-relaxed">
            日事通，万事皆成
          </p>
        </div>
      </aside>
    </>
  );
}
