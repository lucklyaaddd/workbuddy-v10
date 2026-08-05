/**
 * PC 端左侧导航栏
 * 可折叠侧边栏，像素森系风格
 */
import { NavLink } from 'react-router-dom';
import {
  PixelHouse,
  PixelBook,
  PixelCoin,
  PixelHeart,
  PixelClock,
  PixelGear,
  PixelRecipe,
} from '@/components/pixel/PixelIcons';
import { DottedPattern, PixelGrass, PixelDogLine, LeafTexture } from '@/components/pixel/Decorations';

// ============ 导航菜单项配置 ============
interface NavItem {
  to: string;                 // 路由路径
  label: string;              // 菜单名称
  icon: React.ComponentType<{ size?: number }>;
}

const navItems: NavItem[] = [
  { to: '/', label: '今日中枢', icon: PixelHouse },
  { to: '/inspiration', label: '灵感补给站', icon: PixelBook },
  { to: '/wealth', label: '财富工坊', icon: PixelCoin },
  { to: '/capsule', label: '时光胶囊', icon: PixelHeart },
  { to: '/reminders', label: '智能提醒中心', icon: PixelClock },
  { to: '/recipes', label: '私厨菜谱', icon: PixelRecipe },
  { to: '/settings', label: '设置', icon: PixelGear },
];

interface SidebarProps {
  collapsed: boolean;         // 是否折叠
  onToggle: () => void;       // 切换折叠/展开
}

/**
 * PC 端侧边栏组件
 */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-30 transition-all duration-300 gpu-accelerated"
      style={{ width: collapsed ? 72 : 200, backgroundColor: '#1A3C2A' }}
    >
      {/* 叶片纹理背景 */}
      <LeafTexture opacity={0.05} />
      {/* 波点装饰 */}
      <DottedPattern opacity={0.04} className="top-0 left-0 right-0 h-32" />
      {/* 线条小狗装饰 */}
      <PixelDogLine className="bottom-20 right-2" opacity={0.08} />

      {/* 顶部 Logo 区域 */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-forest-light/15">
        <div className="text-2xl flex-shrink-0">🍎</div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-cream font-bold text-sm whitespace-nowrap">WorkBuddy</h1>
            <p className="text-forest-light text-[10px] whitespace-nowrap">个人工作台</p>
          </div>
        )}
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
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
              }
              title={collapsed ? item.label : ''}
            >
              <Icon size={20} />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* 像素小草装饰 */}
      <PixelGrass className="bottom-16 left-2" opacity={0.15} />

      {/* 底部品牌标语 */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-forest-light/15">
          <p className="text-forest-light text-[10px] leading-relaxed whitespace-nowrap">
            🌿 天地通，年月通
          </p>
          <p className="text-forest-light text-[10px] leading-relaxed whitespace-nowrap">
            日事通，万事皆成
          </p>
        </div>
      )}

      {/* 折叠/展开按钮 */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-10 border-t border-forest-light/15 text-forest-light hover:bg-forest-light/10 transition-colors"
        aria-label={collapsed ? '展开' : '折叠'}
      >
        <span className="text-lg">{collapsed ? '›' : '‹'}</span>
      </button>
    </aside>
  );
}
