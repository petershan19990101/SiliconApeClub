INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT parent.id, action_menu.code, action_menu.name, 'action', NULL, NULL, action_menu.sort_order, 1
FROM (
    SELECT 'permission.menu.view' AS parent_code, 'permission.menu.create' AS code, '创建菜单' AS name, 10 AS sort_order
    UNION ALL SELECT 'permission.menu.view', 'permission.menu.edit', '编辑菜单', 20
    UNION ALL SELECT 'permission.menu.view', 'permission.menu.delete', '删除菜单', 30
    UNION ALL SELECT 'permission.role.view', 'permission.role.create', '创建角色', 10
    UNION ALL SELECT 'permission.role.view', 'permission.role.edit', '编辑角色', 20
    UNION ALL SELECT 'permission.role.view', 'permission.role.delete', '删除角色', 30
    UNION ALL SELECT 'permission.role.view', 'permission.role.assign', '角色授权', 40
    UNION ALL SELECT 'permission.user.view', 'permission.user.create', '创建用户', 10
    UNION ALL SELECT 'permission.user.view', 'permission.user.edit', '编辑用户', 20
    UNION ALL SELECT 'permission.user.view', 'permission.user.enable', '启用用户', 30
    UNION ALL SELECT 'permission.user.view', 'permission.user.disable', '停用用户', 40
    UNION ALL SELECT 'permission.user.view', 'permission.user.assign_role', '分配角色', 50
    UNION ALL SELECT 'permission.user.view', 'permission.user.reset_password', '重置密码', 60
    UNION ALL SELECT 'permission.department.view', 'permission.department.create', '创建部门', 10
    UNION ALL SELECT 'permission.department.view', 'permission.department.edit', '编辑部门', 20
    UNION ALL SELECT 'permission.department.view', 'permission.department.delete', '删除部门', 30
) action_menu
JOIN sys_menu parent ON parent.code = action_menu.parent_code
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
  AND menu.code LIKE 'permission.%'
  AND NOT EXISTS (
      SELECT 1
      FROM sys_role_permission permission
      WHERE permission.role_id = role.id
        AND permission.menu_id = menu.id
  );
