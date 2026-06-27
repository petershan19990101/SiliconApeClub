INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 41, 8, 'settings.parse_config.view', '解析配置', 'page', 'settings_parse_config', 'settings', 10, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'settings.parse_config.view');

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 42, 8, 'settings.document_policy.view', '文档策略', 'page', 'settings_document_policy', 'settings', 20, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'settings.document_policy.view');

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 43, 8, 'settings.integration_switches.view', '集成开关', 'page', 'settings_integration_switches', 'settings', 30, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'settings.integration_switches.view');

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 44, 8, 'settings.platform_info.view', '平台信息', 'page', 'settings_platform_info', 'settings', 40, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'settings.platform_info.view');

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 45, 41, 'settings.parse_config.create', '新增解析绑定', 'action', NULL, NULL, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'settings.parse_config.create');

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 46, 41, 'settings.parse_config.edit', '编辑解析绑定', 'action', NULL, NULL, 20, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'settings.parse_config.edit');

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 47, 41, 'settings.parse_config.delete', '删除解析绑定', 'action', NULL, NULL, 30, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'settings.parse_config.delete');

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 41
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 41);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 42
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 42);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 43
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 43);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 44
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 44);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 45
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 45);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 46
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 46);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 47
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 47);