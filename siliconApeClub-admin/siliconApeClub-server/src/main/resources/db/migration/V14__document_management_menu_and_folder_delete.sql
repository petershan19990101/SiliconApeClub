UPDATE sys_menu
SET name = '文档管理'
WHERE route_key = 'library'
   OR code = 'library.view';

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT parent.id, 'folder.delete', '删除目录', 'action', NULL, NULL, 140, 1
FROM sys_menu parent
WHERE parent.code = 'library.view'
ON DUPLICATE KEY UPDATE
    parent_id = VALUES(parent_id),
    name = VALUES(name),
    type = VALUES(type),
    route_key = VALUES(route_key),
    icon = VALUES(icon),
    sort_order = VALUES(sort_order),
    enabled = VALUES(enabled);

INSERT INTO sys_role_permission(role_id, menu_id)
SELECT role.id, menu.id
FROM sys_role role
JOIN sys_menu menu
WHERE (role.admin_role = 1 OR role.code = 'ADMIN')
  AND menu.code IN ('library.view', 'folder.delete')
  AND NOT EXISTS (
      SELECT 1
      FROM sys_role_permission permission
      WHERE permission.role_id = role.id
        AND permission.menu_id = menu.id
  );
