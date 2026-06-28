import { SystemMenuNode, User, View } from '../types';

const FALLBACK_VISIBLE_VIEWS: View[] = ['dashboard', 'library', 'search'];

export function hasSystemPermission(user: User | null, permissionCode: string) {
  if (!user) {
    return false;
  }
  if (user.role === 'admin' && !(user.buttonPermissions ?? []).length) {
    return true;
  }
  return (user.buttonPermissions ?? []).includes(permissionCode) || (user.menus ?? []).some((menu) => menu.code === permissionCode);
}

export function getVisibleViews(user: User | null): View[] {
  if (!user || !user.menus?.length) {
    return FALLBACK_VISIBLE_VIEWS;
  }

  const views = flattenMenus(user.menus)
    .filter((menu) => menu.type === 'page' && menu.routeKey)
    .map((menu) => menu.routeKey as View)
    .filter((view): view is View =>
      ['dashboard', 'library', 'search', 'permission', 'wiki', 'position_packages', 'knowledge_health', 'rag_debug', 'ai_employees', 'skill_repository', 'customer_members', 'settings', 'help'].includes(view)
    );

  return views.length ? views : FALLBACK_VISIBLE_VIEWS;
}

export function flattenMenus(menus: SystemMenuNode[]): SystemMenuNode[] {
  const result: SystemMenuNode[] = [];
  const walk = (nodes: SystemMenuNode[]) => {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children.length) {
        walk(node.children);
      }
    });
  };
  walk(menus);
  return result;
}
