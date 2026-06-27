ALTER TABLE ds_folder
    ADD COLUMN deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除标记，1 已删除，0 有效';

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 35, 2, 'document.delete', '删除文档', 'action', NULL, NULL, 130, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'document.delete');

INSERT INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT 36, 2, 'folder.delete', '删除目录', 'action', NULL, NULL, 140, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE code = 'folder.delete');

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 35
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 35);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, 36
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission WHERE role_id = 1 AND menu_id = 36);
