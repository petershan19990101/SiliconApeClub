CREATE TABLE IF NOT EXISTS sys_menu (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '菜单资源主键',
    parent_id BIGINT NULL COMMENT '父级菜单 ID',
    code VARCHAR(128) NOT NULL COMMENT '资源编码',
    name VARCHAR(128) NOT NULL COMMENT '资源名称',
    type VARCHAR(32) NOT NULL COMMENT '资源类型 menu/page/action',
    route_key VARCHAR(64) NULL COMMENT '前端路由键',
    icon VARCHAR(64) NULL COMMENT '图标枚举',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值',
    enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_sys_menu_code (code)
) COMMENT='系统菜单与按钮资源表';

CREATE TABLE IF NOT EXISTS sys_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '角色主键',
    code VARCHAR(64) NOT NULL COMMENT '角色编码',
    name VARCHAR(64) NOT NULL COMMENT '角色名称',
    description VARCHAR(255) NULL COMMENT '角色描述',
    enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
    built_in TINYINT NOT NULL DEFAULT 0 COMMENT '是否内置角色',
    admin_role TINYINT NOT NULL DEFAULT 0 COMMENT '是否管理员角色',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_sys_role_code (code)
) COMMENT='系统角色表';

CREATE TABLE IF NOT EXISTS sys_user_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户角色关系主键',
    user_id BIGINT NOT NULL COMMENT '用户 ID',
    role_id BIGINT NOT NULL COMMENT '角色 ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_sys_user_role (user_id, role_id)
) COMMENT='用户与角色多对多关系表';

CREATE TABLE IF NOT EXISTS sys_role_permission (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '角色权限关系主键',
    role_id BIGINT NOT NULL COMMENT '角色 ID',
    menu_id BIGINT NOT NULL COMMENT '资源 ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_sys_role_permission (role_id, menu_id)
) COMMENT='角色与菜单/按钮权限关系表';

CREATE TABLE IF NOT EXISTS sys_permission_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '权限审计主键',
    target_type VARCHAR(32) NOT NULL COMMENT '对象类型',
    target_id BIGINT NOT NULL COMMENT '对象 ID',
    target_name VARCHAR(128) NOT NULL COMMENT '对象名称',
    action VARCHAR(64) NOT NULL COMMENT '操作动作',
    operator_id BIGINT NOT NULL COMMENT '操作人 ID',
    operator_name VARCHAR(64) NOT NULL COMMENT '操作人名称',
    detail_json LONGTEXT NULL COMMENT '变更详情 JSON',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) COMMENT='权限管理后台操作审计表';

CREATE INDEX idx_sys_menu_parent ON sys_menu(parent_id, sort_order);
CREATE INDEX idx_sys_user_role_user ON sys_user_role(user_id);
CREATE INDEX idx_sys_role_permission_role ON sys_role_permission(role_id);
CREATE INDEX idx_sys_permission_audit_target ON sys_permission_audit(target_type, target_id);
