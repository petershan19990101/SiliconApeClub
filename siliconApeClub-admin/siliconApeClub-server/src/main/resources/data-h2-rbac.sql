MERGE INTO sys_role (id, code, name, description, enabled, built_in, admin_role) KEY(id) VALUES
    (1, 'ADMIN', '管理员', '系统内置管理员角色', 1, 1, 1),
    (2, 'MEMBER', '普通成员', '系统内置普通成员角色', 1, 1, 0);

MERGE INTO sys_menu (id, parent_id, code, name, type, route_key, icon, sort_order, enabled) KEY(id) VALUES
    (1, NULL, 'dashboard.view', '工作台', 'page', 'dashboard', 'dashboard', 10, 1),
    (2, NULL, 'library.view', '文档管理', 'page', 'library', 'library', 20, 1),
    (3, NULL, 'search.view', '全局搜索', 'page', 'search', 'search', 30, 1),
    (4, NULL, 'permission_management.view', '权限管理', 'page', 'permission', 'shield', 40, 1),
    (5, 4, 'permission.menu.view', '菜单管理', 'page', 'permission_menus', 'menu', 10, 1),
    (6, 4, 'permission.role.view', '角色管理', 'page', 'permission_roles', 'users', 20, 1),
    (7, 4, 'permission.user.view', '用户管理', 'page', 'permission_users', 'users', 30, 1),
    (8, NULL, 'settings.view', '系统设置', 'page', 'settings', 'settings', 90, 1),
    (9, NULL, 'help.view', '帮助中心', 'page', 'help', 'help', 100, 1),
    (10, 2, 'library.upload', '上传文档', 'action', NULL, NULL, 10, 1),
    (11, 2, 'library.create_folder', '新建文件夹', 'action', NULL, NULL, 20, 1),
    (12, 2, 'document.permission.manage', '管理文档权限', 'action', NULL, NULL, 30, 1),
    (13, 2, 'folder.permission.manage', '管理目录权限', 'action', NULL, NULL, 40, 1),
    (14, 2, 'document.view', '查看文档', 'action', NULL, NULL, 50, 1),
    (15, 2, 'document.correct', '校正文档', 'action', NULL, NULL, 60, 1),
    (16, 2, 'document.push_rag', '生成 Wiki/RAG', 'action', NULL, NULL, 70, 1),
    (17, 2, 'document.request_audit', '提交审核', 'action', NULL, NULL, 80, 1),
    (18, 2, 'document.publish', '审核发布', 'action', NULL, NULL, 90, 1),
    (19, 2, 'document.reject', '审核驳回', 'action', NULL, NULL, 100, 1),
    (20, 2, 'document.create_revision', '创建修订', 'action', NULL, NULL, 110, 1),
    (21, 2, 'document.lock', '锁定版本', 'action', NULL, NULL, 120, 1),
    (22, 5, 'permission.menu.create', '创建菜单', 'action', NULL, NULL, 10, 1),
    (23, 5, 'permission.menu.edit', '编辑菜单', 'action', NULL, NULL, 20, 1),
    (24, 5, 'permission.menu.delete', '删除菜单', 'action', NULL, NULL, 30, 1),
    (25, 6, 'permission.role.create', '创建角色', 'action', NULL, NULL, 10, 1),
    (26, 6, 'permission.role.edit', '编辑角色', 'action', NULL, NULL, 20, 1),
    (27, 6, 'permission.role.delete', '删除角色', 'action', NULL, NULL, 30, 1),
    (28, 6, 'permission.role.assign', '角色授权', 'action', NULL, NULL, 40, 1),
    (29, 7, 'permission.user.create', '创建用户', 'action', NULL, NULL, 10, 1),
    (30, 7, 'permission.user.edit', '编辑用户', 'action', NULL, NULL, 20, 1),
    (31, 7, 'permission.user.enable', '启用用户', 'action', NULL, NULL, 30, 1),
    (32, 7, 'permission.user.disable', '停用用户', 'action', NULL, NULL, 40, 1),
    (33, 7, 'permission.user.assign_role', '分配角色', 'action', NULL, NULL, 50, 1),
    (34, 7, 'permission.user.reset_password', '重置密码', 'action', NULL, NULL, 60, 1),
    (35, 2, 'document.delete', '删除文档', 'action', NULL, NULL, 130, 1),
    (36, 2, 'folder.delete', '删除目录', 'action', NULL, NULL, 140, 1),
    (37, 4, 'permission.department.view', '部门管理', 'page', 'permission_departments', 'users', 40, 1),
    (38, 37, 'permission.department.create', '创建部门', 'action', NULL, NULL, 10, 1),
    (39, 37, 'permission.department.edit', '编辑部门', 'action', NULL, NULL, 20, 1),
    (40, 37, 'permission.department.delete', '删除部门', 'action', NULL, NULL, 30, 1),
    (41, 8, 'settings.parse_config.view', '解析配置', 'page', 'settings_parse_config', 'settings', 10, 1),
    (42, 8, 'settings.document_policy.view', '文档策略', 'page', 'settings_document_policy', 'settings', 20, 1),
    (43, 8, 'settings.integration_switches.view', '集成开关', 'page', 'settings_integration_switches', 'settings', 30, 1),
    (44, 8, 'settings.platform_info.view', '平台信息', 'page', 'settings_platform_info', 'settings', 40, 1),
    (45, 41, 'settings.parse_config.create', '新增解析绑定', 'action', NULL, NULL, 10, 1),
    (46, 41, 'settings.parse_config.edit', '编辑解析绑定', 'action', NULL, NULL, 20, 1),
    (47, 41, 'settings.parse_config.delete', '删除解析绑定', 'action', NULL, NULL, 30, 1);

MERGE INTO sys_user_role (id, user_id, role_id) KEY(id) VALUES
    (1, 1, 1),
    (2, 2, 2),
    (3, 3, 2),
    (4, 4, 2);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, id
FROM sys_menu
WHERE NOT EXISTS (
    SELECT 1 FROM sys_role_permission permission
    WHERE permission.role_id = 1 AND permission.menu_id = sys_menu.id
);

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 2, id
FROM sys_menu
WHERE id IN (1, 2, 3, 8, 9, 10, 11, 14, 15, 16, 17)
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission permission
    WHERE permission.role_id = 2 AND permission.menu_id = sys_menu.id
);
