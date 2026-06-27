CREATE TABLE IF NOT EXISTS ds_department (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '部门主键 ID',
    parent_id BIGINT NULL COMMENT '上级部门 ID，用于构建部门树',
    name VARCHAR(128) NOT NULL COMMENT '部门名称',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT='部门表，维护组织层级结构';

CREATE TABLE IF NOT EXISTS ds_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户主键 ID',
    username VARCHAR(64) NOT NULL UNIQUE COMMENT '登录用户名',
    display_name VARCHAR(64) NOT NULL COMMENT '用户显示名称',
    email VARCHAR(128) NOT NULL COMMENT '用户邮箱',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    role_code VARCHAR(32) NOT NULL COMMENT '角色编码，如 ADMIN、MEMBER',
    department_id BIGINT NULL COMMENT '所属部门 ID',
    enabled TINYINT NOT NULL DEFAULT 1 COMMENT '启用状态，1 启用，0 禁用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT='用户表，保存登录账号和角色信息';

CREATE TABLE IF NOT EXISTS ds_folder (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '目录主键 ID',
    name VARCHAR(128) NOT NULL COMMENT '目录名称',
    department_id BIGINT NOT NULL COMMENT '归属部门 ID',
    parent_id BIGINT NULL COMMENT '父目录 ID',
    created_by BIGINT NOT NULL COMMENT '创建人 ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT='目录表，用于组织文档库层级结构';

CREATE TABLE IF NOT EXISTS ds_folder_permission (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '目录权限记录主键',
    folder_id BIGINT NOT NULL COMMENT '目录 ID',
    user_id BIGINT NOT NULL COMMENT '用户 ID',
    role_code VARCHAR(32) NOT NULL COMMENT '授权对象角色编码',
    permissions_json TEXT NOT NULL COMMENT '权限动作 JSON 数组',
    inherited_from VARCHAR(128) NULL COMMENT '权限继承来源标记',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT='目录权限表，保存目录级别的显式授权';

CREATE TABLE IF NOT EXISTS ds_document (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '文档主键 ID',
    name VARCHAR(255) NOT NULL COMMENT '文档名称',
    description VARCHAR(500) NOT NULL COMMENT '文档简介',
    tags_json TEXT NULL COMMENT '标签 JSON 数组',
    current_version INT NOT NULL DEFAULT 1 COMMENT '当前工作版本号',
    live_version INT NULL COMMENT '已发布版本号',
    status VARCHAR(32) NOT NULL COMMENT '文档生命周期状态',
    department_id BIGINT NOT NULL COMMENT '归属部门 ID',
    folder_id BIGINT NULL COMMENT '所在目录 ID',
    latest_source_file VARCHAR(255) NULL COMMENT '最新源文件名称',
    latest_parsed_text LONGTEXT NULL COMMENT '最新解析文本内容',
    parse_status VARCHAR(32) NOT NULL COMMENT '解析任务状态',
    parse_started_at DATETIME NULL COMMENT '解析开始时间',
    parse_finished_at DATETIME NULL COMMENT '解析完成时间',
    parse_attempt_count INT NOT NULL DEFAULT 0 COMMENT '解析尝试次数',
    parse_engine VARCHAR(128) NULL COMMENT '解析引擎名称',
    parse_error_message VARCHAR(500) NULL COMMENT '解析失败原因',
    parse_last_run_by VARCHAR(64) NULL COMMENT '最近一次触发解析的用户名称',
    rag_status VARCHAR(32) NOT NULL COMMENT 'RAG 同步任务状态',
    rag_started_at DATETIME NULL COMMENT 'RAG 同步开始时间',
    rag_finished_at DATETIME NULL COMMENT 'RAG 同步完成时间',
    rag_attempt_count INT NOT NULL DEFAULT 0 COMMENT 'RAG 同步尝试次数',
    rag_error_message VARCHAR(500) NULL COMMENT 'RAG 同步失败原因',
    rag_last_run_by VARCHAR(64) NULL COMMENT '最近一次触发 RAG 同步的用户名称',
    rejected_reason VARCHAR(500) NULL COMMENT '审核驳回原因',
    revision_source_document_id BIGINT NULL COMMENT '修订草稿来源文档 ID',
    revision_source_version INT NULL COMMENT '修订草稿来源版本号',
    live_document_id BIGINT NULL COMMENT '关联的线上主文档 ID',
    revision_draft TINYINT NOT NULL DEFAULT 0 COMMENT '是否为修订草稿，1 是，0 否',
    locked_from_status VARCHAR(32) NULL COMMENT '锁定前的原始状态',
    storage_bucket VARCHAR(128) NULL COMMENT '对象存储桶名称',
    storage_object VARCHAR(255) NULL COMMENT '对象存储文件键',
    created_by BIGINT NOT NULL COMMENT '创建人 ID',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除标记，1 已删除，0 有效',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT='文档主表，保存当前文档状态与最新版本信息';

CREATE TABLE IF NOT EXISTS ds_document_version (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '版本记录主键',
    document_id BIGINT NOT NULL COMMENT '所属文档 ID',
    version INT NOT NULL COMMENT '版本号',
    source_file_name VARCHAR(255) NULL COMMENT '源文件名称',
    parsed_content LONGTEXT NULL COMMENT '该版本解析正文',
    engine VARCHAR(128) NULL COMMENT '生成该版本的解析引擎',
    author VARCHAR(64) NULL COMMENT '版本作者名称',
    status VARCHAR(32) NOT NULL COMMENT '版本状态，如 draft、published、archived',
    summary VARCHAR(500) NULL COMMENT '版本摘要说明',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '版本创建时间'
) COMMENT='文档版本表，记录文档每个版本的正文快照';

CREATE TABLE IF NOT EXISTS ds_document_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '审计记录主键',
    document_id BIGINT NOT NULL COMMENT '关联文档 ID',
    version INT NOT NULL COMMENT '关联版本号',
    action VARCHAR(32) NOT NULL COMMENT '审计动作类型',
    operator_id BIGINT NOT NULL COMMENT '操作人 ID',
    operator_name VARCHAR(64) NOT NULL COMMENT '操作人名称',
    comment VARCHAR(500) NULL COMMENT '操作备注或驳回说明',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间'
) COMMENT='文档审计表，记录生命周期中的关键操作';

CREATE TABLE IF NOT EXISTS ds_document_permission (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '文档权限记录主键',
    document_id BIGINT NOT NULL COMMENT '文档 ID',
    user_id BIGINT NOT NULL COMMENT '用户 ID',
    role_code VARCHAR(32) NOT NULL COMMENT '授权对象角色编码',
    permissions_json TEXT NOT NULL COMMENT '权限动作 JSON 数组',
    inherited_from VARCHAR(128) NULL COMMENT '权限继承来源标记',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT='文档权限表，保存文档级别的显式授权';

CREATE INDEX idx_document_status ON ds_document(status);
CREATE INDEX idx_document_department ON ds_document(department_id);
CREATE INDEX idx_document_folder ON ds_document(folder_id);
CREATE INDEX idx_document_live ON ds_document(live_document_id);
CREATE INDEX idx_document_audit_document ON ds_document_audit(document_id);
CREATE INDEX idx_document_version_document ON ds_document_version(document_id);
