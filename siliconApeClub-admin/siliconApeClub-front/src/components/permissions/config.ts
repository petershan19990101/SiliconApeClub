export const MENU_TYPE_OPTIONS = [
  { value: 'page', label: '页面' },
  { value: 'action', label: '按钮权限' },
  { value: 'menu', label: '菜单分组' },
] as const;

export const ROUTE_KEY_OPTIONS = [
  { value: 'dashboard', label: '工作台' },
  { value: 'library', label: '知识资产' },
  { value: 'search', label: '全域检索' },
  { value: 'permission', label: '权限管理' },
  { value: 'permission_menus', label: '权限管理 / 菜单管理' },
  { value: 'permission_roles', label: '权限管理 / 角色管理' },
  { value: 'permission_users', label: '权限管理 / 用户管理' },
  { value: 'permission_departments', label: '权限管理 / 部门管理' },
  { value: 'settings', label: '系统设置' },
  { value: 'settings_parse_config', label: '系统设置 / 解析配置' },
  { value: 'settings_document_policy', label: '系统设置 / 文档策略' },
  { value: 'settings_integration_switches', label: '系统设置 / 集成开关' },
  { value: 'settings_platform_info', label: '系统设置 / 平台信息' },
  { value: 'help', label: '帮助中心' },
] as const;

export const ICON_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'library', label: 'Library' },
  { value: 'search', label: 'Search' },
  { value: 'shield', label: 'Shield' },
  { value: 'settings', label: 'Settings' },
  { value: 'help', label: 'Help' },
  { value: 'menu', label: 'Menu' },
  { value: 'users', label: 'Users' },
] as const;
