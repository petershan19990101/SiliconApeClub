UPDATE sys_menu
SET name = '文档管理',
    updated_at = CURRENT_TIMESTAMP
WHERE route_key = 'library'
   OR code = 'library.view';

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT parent.id, 'folder.delete', '删除目录', 'action', NULL, NULL, 140, 1
FROM sys_menu parent
WHERE parent.code = 'library.view'
ON CONFLICT (code) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    route_key = EXCLUDED.route_key,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_role_permission(role_id, menu_id)
SELECT role.id, menu.id
FROM sys_role role
CROSS JOIN sys_menu menu
WHERE (role.admin_role = 1 OR role.code = 'ADMIN')
  AND menu.code IN ('library.view', 'folder.delete')
ON CONFLICT (role_id, menu_id) DO NOTHING;
