CREATE TABLE IF NOT EXISTS ds_department (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    parent_id BIGINT NULL,
    name VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ds_department IS '部门表，维护组织层级结构';
COMMENT ON COLUMN ds_department.id IS '部门主键 ID';
COMMENT ON COLUMN ds_department.parent_id IS '上级部门 ID，用于构建部门树';
COMMENT ON COLUMN ds_department.name IS '部门名称';
COMMENT ON COLUMN ds_department.created_at IS '创建时间';
COMMENT ON COLUMN ds_department.updated_at IS '更新时间';

CREATE TABLE IF NOT EXISTS ds_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(64) NOT NULL,
    email VARCHAR(128) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_code VARCHAR(32) NOT NULL,
    department_id BIGINT NULL,
    enabled TINYINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ds_user IS '用户表，保存登录账号和角色信息';
COMMENT ON COLUMN ds_user.id IS '用户主键 ID';
COMMENT ON COLUMN ds_user.username IS '登录用户名';
COMMENT ON COLUMN ds_user.display_name IS '用户显示名称';
COMMENT ON COLUMN ds_user.email IS '用户邮箱';
COMMENT ON COLUMN ds_user.password_hash IS '密码哈希';
COMMENT ON COLUMN ds_user.role_code IS '角色编码';
COMMENT ON COLUMN ds_user.department_id IS '所属部门 ID';
COMMENT ON COLUMN ds_user.enabled IS '启用状态';
COMMENT ON COLUMN ds_user.created_at IS '创建时间';
COMMENT ON COLUMN ds_user.updated_at IS '更新时间';

CREATE TABLE IF NOT EXISTS ds_folder (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    department_id BIGINT NOT NULL,
    parent_id BIGINT NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ds_folder IS '目录表，用于组织文档库层级结构';
COMMENT ON COLUMN ds_folder.id IS '目录主键 ID';
COMMENT ON COLUMN ds_folder.name IS '目录名称';
COMMENT ON COLUMN ds_folder.department_id IS '归属部门 ID';
COMMENT ON COLUMN ds_folder.parent_id IS '父目录 ID';
COMMENT ON COLUMN ds_folder.created_by IS '创建人 ID';
COMMENT ON COLUMN ds_folder.created_at IS '创建时间';
COMMENT ON COLUMN ds_folder.updated_at IS '更新时间';

CREATE TABLE IF NOT EXISTS ds_folder_permission (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    folder_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_code VARCHAR(32) NOT NULL,
    permissions_json CLOB NOT NULL,
    inherited_from VARCHAR(128) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ds_folder_permission IS '目录权限表，保存目录级别的显式授权';
COMMENT ON COLUMN ds_folder_permission.id IS '目录权限记录主键';
COMMENT ON COLUMN ds_folder_permission.folder_id IS '目录 ID';
COMMENT ON COLUMN ds_folder_permission.user_id IS '用户 ID';
COMMENT ON COLUMN ds_folder_permission.role_code IS '授权对象角色编码';
COMMENT ON COLUMN ds_folder_permission.permissions_json IS '权限动作 JSON 数组';
COMMENT ON COLUMN ds_folder_permission.inherited_from IS '权限继承来源标记';
COMMENT ON COLUMN ds_folder_permission.created_at IS '创建时间';
COMMENT ON COLUMN ds_folder_permission.updated_at IS '更新时间';

CREATE TABLE IF NOT EXISTS ds_document (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500) NOT NULL,
    tags_json CLOB NULL,
    current_version INT NOT NULL DEFAULT 1,
    live_version INT NULL,
    status VARCHAR(32) NOT NULL,
    department_id BIGINT NOT NULL,
    folder_id BIGINT NULL,
    latest_source_file VARCHAR(255) NULL,
    latest_parsed_text CLOB NULL,
    parse_status VARCHAR(32) NOT NULL,
    parse_started_at TIMESTAMP NULL,
    parse_finished_at TIMESTAMP NULL,
    parse_attempt_count INT NOT NULL DEFAULT 0,
    parse_engine VARCHAR(128) NULL,
    parse_error_message VARCHAR(500) NULL,
    parse_last_run_by VARCHAR(64) NULL,
    rag_status VARCHAR(32) NOT NULL,
    rag_started_at TIMESTAMP NULL,
    rag_finished_at TIMESTAMP NULL,
    rag_attempt_count INT NOT NULL DEFAULT 0,
    rag_error_message VARCHAR(500) NULL,
    rag_last_run_by VARCHAR(64) NULL,
    rejected_reason VARCHAR(500) NULL,
    revision_source_document_id BIGINT NULL,
    revision_source_version INT NULL,
    live_document_id BIGINT NULL,
    revision_draft TINYINT NOT NULL DEFAULT 0,
    locked_from_status VARCHAR(32) NULL,
    storage_bucket VARCHAR(128) NULL,
    storage_object VARCHAR(255) NULL,
    created_by BIGINT NOT NULL,
    deleted TINYINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ds_document IS '文档主表，保存当前文档状态与最新版本信息';
COMMENT ON COLUMN ds_document.id IS '文档主键 ID';
COMMENT ON COLUMN ds_document.name IS '文档名称';
COMMENT ON COLUMN ds_document.description IS '文档简介';
COMMENT ON COLUMN ds_document.tags_json IS '标签 JSON 数组';
COMMENT ON COLUMN ds_document.current_version IS '当前工作版本号';
COMMENT ON COLUMN ds_document.live_version IS '已发布版本号';
COMMENT ON COLUMN ds_document.status IS '文档生命周期状态';
COMMENT ON COLUMN ds_document.department_id IS '归属部门 ID';
COMMENT ON COLUMN ds_document.folder_id IS '所在目录 ID';
COMMENT ON COLUMN ds_document.latest_source_file IS '最新源文件名称';
COMMENT ON COLUMN ds_document.latest_parsed_text IS '最新解析文本内容';
COMMENT ON COLUMN ds_document.parse_status IS '解析任务状态';
COMMENT ON COLUMN ds_document.parse_started_at IS '解析开始时间';
COMMENT ON COLUMN ds_document.parse_finished_at IS '解析完成时间';
COMMENT ON COLUMN ds_document.parse_attempt_count IS '解析尝试次数';
COMMENT ON COLUMN ds_document.parse_engine IS '解析引擎名称';
COMMENT ON COLUMN ds_document.parse_error_message IS '解析失败原因';
COMMENT ON COLUMN ds_document.parse_last_run_by IS '最近一次触发解析的用户名称';
COMMENT ON COLUMN ds_document.rag_status IS 'RAG 同步任务状态';
COMMENT ON COLUMN ds_document.rag_started_at IS 'RAG 同步开始时间';
COMMENT ON COLUMN ds_document.rag_finished_at IS 'RAG 同步完成时间';
COMMENT ON COLUMN ds_document.rag_attempt_count IS 'RAG 同步尝试次数';
COMMENT ON COLUMN ds_document.rag_error_message IS 'RAG 同步失败原因';
COMMENT ON COLUMN ds_document.rag_last_run_by IS '最近一次触发 RAG 同步的用户名称';
COMMENT ON COLUMN ds_document.rejected_reason IS '审核驳回原因';
COMMENT ON COLUMN ds_document.revision_source_document_id IS '修订草稿来源文档 ID';
COMMENT ON COLUMN ds_document.revision_source_version IS '修订草稿来源版本号';
COMMENT ON COLUMN ds_document.live_document_id IS '关联的线上主文档 ID';
COMMENT ON COLUMN ds_document.revision_draft IS '是否为修订草稿';
COMMENT ON COLUMN ds_document.locked_from_status IS '锁定前的原始状态';
COMMENT ON COLUMN ds_document.storage_bucket IS '对象存储桶名称';
COMMENT ON COLUMN ds_document.storage_object IS '对象存储文件键';
COMMENT ON COLUMN ds_document.created_by IS '创建人 ID';
COMMENT ON COLUMN ds_document.deleted IS '逻辑删除标记';
COMMENT ON COLUMN ds_document.created_at IS '创建时间';
COMMENT ON COLUMN ds_document.updated_at IS '更新时间';

CREATE TABLE IF NOT EXISTS ds_document_version (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    version INT NOT NULL,
    source_file_name VARCHAR(255) NULL,
    parsed_content CLOB NULL,
    engine VARCHAR(128) NULL,
    author VARCHAR(64) NULL,
    status VARCHAR(32) NOT NULL,
    summary VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ds_document_version IS '文档版本表，记录文档每个版本的正文快照';
COMMENT ON COLUMN ds_document_version.id IS '版本记录主键';
COMMENT ON COLUMN ds_document_version.document_id IS '所属文档 ID';
COMMENT ON COLUMN ds_document_version.version IS '版本号';
COMMENT ON COLUMN ds_document_version.source_file_name IS '源文件名称';
COMMENT ON COLUMN ds_document_version.parsed_content IS '该版本解析正文';
COMMENT ON COLUMN ds_document_version.engine IS '生成该版本的解析引擎';
COMMENT ON COLUMN ds_document_version.author IS '版本作者名称';
COMMENT ON COLUMN ds_document_version.status IS '版本状态';
COMMENT ON COLUMN ds_document_version.summary IS '版本摘要说明';
COMMENT ON COLUMN ds_document_version.created_at IS '版本创建时间';

CREATE TABLE IF NOT EXISTS ds_document_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    version INT NOT NULL,
    action VARCHAR(32) NOT NULL,
    operator_id BIGINT NOT NULL,
    operator_name VARCHAR(64) NOT NULL,
    comment VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ds_document_audit IS '文档审计表，记录生命周期中的关键操作';
COMMENT ON COLUMN ds_document_audit.id IS '审计记录主键';
COMMENT ON COLUMN ds_document_audit.document_id IS '关联文档 ID';
COMMENT ON COLUMN ds_document_audit.version IS '关联版本号';
COMMENT ON COLUMN ds_document_audit.action IS '审计动作类型';
COMMENT ON COLUMN ds_document_audit.operator_id IS '操作人 ID';
COMMENT ON COLUMN ds_document_audit.operator_name IS '操作人名称';
COMMENT ON COLUMN ds_document_audit.comment IS '操作备注或驳回说明';
COMMENT ON COLUMN ds_document_audit.created_at IS '记录创建时间';

CREATE TABLE IF NOT EXISTS ds_document_permission (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_code VARCHAR(32) NOT NULL,
    permissions_json CLOB NOT NULL,
    inherited_from VARCHAR(128) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ds_document_permission IS '文档权限表，保存文档级别的显式授权';
COMMENT ON COLUMN ds_document_permission.id IS '文档权限记录主键';
COMMENT ON COLUMN ds_document_permission.document_id IS '文档 ID';
COMMENT ON COLUMN ds_document_permission.user_id IS '用户 ID';
COMMENT ON COLUMN ds_document_permission.role_code IS '授权对象角色编码';
COMMENT ON COLUMN ds_document_permission.permissions_json IS '权限动作 JSON 数组';
COMMENT ON COLUMN ds_document_permission.inherited_from IS '权限继承来源标记';
COMMENT ON COLUMN ds_document_permission.created_at IS '创建时间';
COMMENT ON COLUMN ds_document_permission.updated_at IS '更新时间';

CREATE TABLE IF NOT EXISTS ds_parse_engine_binding (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    file_extension VARCHAR(32) NOT NULL,
    engine_code VARCHAR(128) NOT NULL,
    engine_name VARCHAR(128) NOT NULL,
    is_default TINYINT NOT NULL DEFAULT 0,
    enabled TINYINT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ds_parse_engine_binding IS '解析引擎与文件类型绑定配置';
COMMENT ON COLUMN ds_parse_engine_binding.id IS '绑定主键';
COMMENT ON COLUMN ds_parse_engine_binding.file_extension IS '文件扩展名';
COMMENT ON COLUMN ds_parse_engine_binding.engine_code IS '引擎编码';
COMMENT ON COLUMN ds_parse_engine_binding.engine_name IS '引擎名称';
COMMENT ON COLUMN ds_parse_engine_binding.is_default IS '是否默认引擎';
COMMENT ON COLUMN ds_parse_engine_binding.enabled IS '是否启用';
COMMENT ON COLUMN ds_parse_engine_binding.sort_order IS '排序值';
COMMENT ON COLUMN ds_parse_engine_binding.created_at IS '创建时间';
COMMENT ON COLUMN ds_parse_engine_binding.updated_at IS '更新时间';

CREATE TABLE IF NOT EXISTS ds_document_parse_artifact (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    version INT NOT NULL,
    artifact_type VARCHAR(32) NOT NULL,
    artifact_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    page_no INT NULL,
    sequence_no INT NULL,
    storage_bucket VARCHAR(128) NOT NULL,
    storage_object VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ds_document_parse_artifact IS '文档解析中间产物与最终产物';
COMMENT ON COLUMN ds_document_parse_artifact.id IS '产物主键';
COMMENT ON COLUMN ds_document_parse_artifact.document_id IS '文档ID';
COMMENT ON COLUMN ds_document_parse_artifact.version IS '版本号';
COMMENT ON COLUMN ds_document_parse_artifact.artifact_type IS '产物类型';
COMMENT ON COLUMN ds_document_parse_artifact.artifact_name IS '产物文件名';
COMMENT ON COLUMN ds_document_parse_artifact.mime_type IS 'MIME类型';
COMMENT ON COLUMN ds_document_parse_artifact.page_no IS '页码';
COMMENT ON COLUMN ds_document_parse_artifact.sequence_no IS '序号';
COMMENT ON COLUMN ds_document_parse_artifact.storage_bucket IS '存储桶';
COMMENT ON COLUMN ds_document_parse_artifact.storage_object IS '存储对象键';
COMMENT ON COLUMN ds_document_parse_artifact.size_bytes IS '字节大小';
COMMENT ON COLUMN ds_document_parse_artifact.created_at IS '创建时间';

CREATE UNIQUE INDEX IF NOT EXISTS idx_parse_engine_binding_unique ON ds_parse_engine_binding(file_extension, engine_code);
CREATE INDEX IF NOT EXISTS idx_parse_engine_binding_lookup ON ds_parse_engine_binding(file_extension, enabled, is_default, sort_order);
CREATE INDEX IF NOT EXISTS idx_parse_artifact_doc_version ON ds_document_parse_artifact(document_id, version, artifact_type, page_no, sequence_no);
