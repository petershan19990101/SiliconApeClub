INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 37, 4, 'permission.department.view', '部门管理', 'page', 'permission_departments', 'users', 40, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'permission.department.view');

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 38, 37, 'permission.department.create', '创建部门', 'action', NULL, NULL, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'permission.department.create');

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 39, 37, 'permission.department.edit', '编辑部门', 'action', NULL, NULL, 20, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'permission.department.edit');

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 40, 37, 'permission.department.delete', '删除部门', 'action', NULL, NULL, 30, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'permission.department.delete');

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 37
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 37);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 38
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 38);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 39
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 39);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 40
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 40);
