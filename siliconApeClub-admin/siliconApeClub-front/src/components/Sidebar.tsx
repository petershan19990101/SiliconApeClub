import React from 'react';
import { Activity, BookOpen, Briefcase, ChevronRight, HelpCircle, LayoutDashboard, Library as LibraryIcon, Search, Settings, Shield, Users, Wrench } from 'lucide-react';
import { SystemMenuNode, View } from '../types';
import { useAppShell } from '../contexts/AppShellContext';
import { useUser } from '../contexts/UserContext';
import { cx } from '../lib/format';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  dashboard: LayoutDashboard,
  library: LibraryIcon,
  search: Search,
  shield: Shield,
  settings: Settings,
  help: HelpCircle,
  menu: LibraryIcon,
  users: Users,
  'book-open': BookOpen,
  briefcase: Briefcase,
  activity: Activity,
  wrench: Wrench,
};

const FALLBACK_MENUS: SystemMenuNode[] = [
  { id: 'dashboard', code: 'dashboard.view', name: '工作台', type: 'page', routeKey: 'dashboard', icon: 'dashboard', sortOrder: 10, enabled: true, children: [] },
  { id: 'library', code: 'library.view', name: '文档管理', type: 'page', routeKey: 'library', icon: 'library', sortOrder: 20, enabled: true, children: [] },
  { id: 'search', code: 'search.view', name: '全域检索', type: 'page', routeKey: 'search', icon: 'search', sortOrder: 30, enabled: true, children: [] },
  { id: 'wiki', code: 'wiki.view', name: 'Wiki 中心', type: 'page', routeKey: 'wiki', icon: 'book-open', sortOrder: 45, enabled: true, children: [] },
  { id: 'position_packages', code: 'position_knowledge.view', name: '岗位知识管理', type: 'page', routeKey: 'position_packages', icon: 'briefcase', sortOrder: 50, enabled: true, children: [] },
  { id: 'knowledge_health', code: 'knowledge_health.view', name: '知识运营健康', type: 'page', routeKey: 'knowledge_health', icon: 'activity', sortOrder: 55, enabled: true, children: [] },
  { id: 'rag_debug', code: 'rag_management.view', name: 'RAG 管理台', type: 'page', routeKey: 'rag_debug', icon: 'search', sortOrder: 60, enabled: true, children: [] },
  { id: 'ai_employees', code: 'organization_hr.view', name: '组织与人力中心', type: 'page', routeKey: 'ai_employees', icon: 'users', sortOrder: 65, enabled: true, children: [] },
  { id: 'skill_repository', code: 'skill_repository.view', name: '技能仓库', type: 'page', routeKey: 'skill_repository', icon: 'wrench', sortOrder: 67, enabled: true, children: [] },
  { id: 'customer_members', code: 'customer_member.view', name: '客户会员中心', type: 'page', routeKey: 'customer_members', icon: 'users', sortOrder: 68, enabled: true, children: [] },
  { id: 'settings', code: 'settings.view', name: '系统设置', type: 'page', routeKey: 'settings', icon: 'settings', sortOrder: 90, enabled: true, children: [] },
  { id: 'help', code: 'help.view', name: '帮助中心', type: 'page', routeKey: 'help', icon: 'help', sortOrder: 100, enabled: true, children: [] },
];

export function Sidebar() {
  const { currentView, setCurrentView } = useAppShell();
  const { currentUser } = useUser();

  const menus = (currentUser?.menus?.length ? currentUser.menus : FALLBACK_MENUS)
    .filter((item) => item.type !== 'action' && item.routeKey)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  const mainMenus = menus.filter((item) => item.routeKey !== 'settings' && item.routeKey !== 'help');
  const utilityMenus = menus.filter((item) => item.routeKey === 'settings' || item.routeKey === 'help');

  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-slate-400">
      <div className="flex items-center gap-3 p-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white">S</div>
        <div>
          <p className="text-lg font-bold tracking-tight text-white">硅基猿猴俱乐部</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-slate-500">Management Console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-4">
        {mainMenus.map((item) => (
          <SidebarMenuButton
            key={item.id}
            menu={item}
            active={currentView === (item.routeKey as View)}
            onClick={() => setCurrentView(item.routeKey as View)}
          />
        ))}
      </nav>

      <div className="space-y-1 border-t border-slate-800 p-4">
        {utilityMenus.map((item) => (
          <SidebarMenuButton
            key={item.id}
            menu={item}
            active={currentView === (item.routeKey as View)}
            onClick={() => setCurrentView(item.routeKey as View)}
            compact
          />
        ))}
      </div>
    </aside>
  );
}

function SidebarMenuButton({
  menu,
  active,
  onClick,
  compact = false,
}: {
  menu: SystemMenuNode;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = ICON_MAP[menu.icon ?? 'dashboard'] ?? LayoutDashboard;

  return (
    <button
      onClick={onClick}
      className={cx(
        'group flex w-full items-center justify-between rounded-xl px-4 py-3 transition',
        active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800 hover:text-slate-200'
      )}
    >
      <span className="flex items-center gap-3">
        <Icon size={20} />
        <span className={cx(compact ? 'text-sm font-bold' : 'text-sm font-bold')}>{menu.name}</span>
      </span>
      {active ? <ChevronRight size={14} /> : null}
    </button>
  );
}
