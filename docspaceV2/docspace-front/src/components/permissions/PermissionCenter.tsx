import React, { useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { SystemMenuNode } from '../../types';
import { MenuManagement } from './MenuManagement';
import { RoleManagement } from './RoleManagement';
import { UserManagement } from './UserManagement';
import { DepartmentManagement } from './DepartmentManagement';

type PermissionTab = 'permission_menus' | 'permission_roles' | 'permission_users' | 'permission_departments';

export function PermissionCenter() {
  const { currentUser } = useUser();
  const permissionRoot = useMemo(
    () => (currentUser?.menus ?? []).find((menu) => menu.routeKey === 'permission'),
    [currentUser?.menus]
  );

  const availableTabs = useMemo(() => {
    const children = permissionRoot?.children ?? [];
    return children.filter((item) =>
      item.routeKey === 'permission_menus'
      || item.routeKey === 'permission_roles'
      || item.routeKey === 'permission_users'
      || item.routeKey === 'permission_departments') as SystemMenuNode[];
  }, [permissionRoot]);

  const [activeTab, setActiveTab] = useState<PermissionTab>(
    (availableTabs[0]?.routeKey as PermissionTab) ?? 'permission_menus'
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'permission_roles':
        return <RoleManagement />;
      case 'permission_users':
        return <UserManagement />;
      case 'permission_departments':
        return <DepartmentManagement />;
      default:
        return <MenuManagement />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-7 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">权限管理</h1>
            <p className="mt-1 text-sm text-slate-500">统一维护菜单、角色和用户的系统级访问控制。</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 rounded-2xl bg-slate-100 p-2">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.routeKey as PermissionTab)}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              activeTab === tab.routeKey ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
}
