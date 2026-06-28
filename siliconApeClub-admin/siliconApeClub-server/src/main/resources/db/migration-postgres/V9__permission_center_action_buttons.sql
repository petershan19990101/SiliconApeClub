WITH action_menus(parent_code, code, name, sort_order) AS (
    VALUES
        ('permission.menu.view', 'permission.menu.create', '创建菜单', 10),
        ('permission.menu.view', 'permission.menu.edit', '编辑菜单', 20),
        ('permission.menu.view', 'permission.menu.delete', '删除菜单', 30),
        ('permission.role.view', 'permission.role.create', '创建角色', 10),
        ('permission.role.view', 'permission.role.edit', '编辑角色', 20),
        ('permission.role.view', 'permission.role.delete', '删除角色', 30),
        ('permission.role.view', 'permission.role.assign', '角色授权', 40),
        ('permission.user.view', 'permission.user.create', '创建用户', 10),
        ('permission.user.view', 'permission.user.edit', '编辑用户', 20),
        ('permission.user.view', 'permission.user.enable', '启用用户', 30),
        ('permission.user.view', 'permission.user.disable', '停用用户', 40),
        ('permission.user.view', 'permission.user.assign_role', '分配角色', 50),
        ('permission.user.view', 'permission.user.reset_password', '重置密码', 60),
        ('permission.department.view', 'permission.department.create', '创建部门', 10),
        ('permission.department.view', 'permission.department.edit', '编辑部门', 20),
        ('permission.department.view', 'permission.department.delete', '删除部门', 30)
)
INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT parent.id, action_menus.code, action_menus.name, 'action', NULL, NULL, action_menus.sort_order, 1
FROM action_menus
JOIN sys_menu parent ON parent.code = action_menus.parent_code
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
  AND menu.code LIKE 'permission.%'
ON CONFLICT (role_id, menu_id) DO NOTHING;
