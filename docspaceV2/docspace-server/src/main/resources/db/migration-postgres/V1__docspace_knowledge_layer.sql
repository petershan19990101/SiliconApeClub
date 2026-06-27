CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE ds_department (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT,
    name VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ds_user (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(64) NOT NULL,
    email VARCHAR(128) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_code VARCHAR(32) NOT NULL,
    department_id BIGINT,
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ds_folder (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    department_id BIGINT NOT NULL,
    parent_id BIGINT,
    created_by BIGINT NOT NULL,
    deleted SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ds_folder_permission (
    id BIGSERIAL PRIMARY KEY,
    folder_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_code VARCHAR(32) NOT NULL,
    permissions_json TEXT NOT NULL,
    inherited_from VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ds_document (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500) NOT NULL,
    tags_json TEXT,
    current_version INT NOT NULL DEFAULT 1,
    live_version INT,
    status VARCHAR(32) NOT NULL,
    department_id BIGINT NOT NULL,
    folder_id BIGINT,
    latest_source_file VARCHAR(255),
    latest_parsed_text TEXT,
    parse_status VARCHAR(32) NOT NULL,
    parse_started_at TIMESTAMP,
    parse_finished_at TIMESTAMP,
    parse_attempt_count INT NOT NULL DEFAULT 0,
    parse_engine VARCHAR(128),
    parse_error_message VARCHAR(500),
    parse_last_run_by VARCHAR(64),
    rag_status VARCHAR(32) NOT NULL,
    rag_started_at TIMESTAMP,
    rag_finished_at TIMESTAMP,
    rag_attempt_count INT NOT NULL DEFAULT 0,
    rag_error_message VARCHAR(500),
    rag_last_run_by VARCHAR(64),
    rejected_reason VARCHAR(500),
    revision_source_document_id BIGINT,
    revision_source_version INT,
    live_document_id BIGINT,
    revision_draft SMALLINT NOT NULL DEFAULT 0,
    locked_from_status VARCHAR(32),
    storage_bucket VARCHAR(128),
    storage_object VARCHAR(255),
    created_by BIGINT NOT NULL,
    deleted SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ds_document_version (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    version INT NOT NULL,
    source_file_name VARCHAR(255),
    parsed_content TEXT,
    engine VARCHAR(128),
    author VARCHAR(64),
    status VARCHAR(32) NOT NULL,
    summary VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ds_document_audit (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    version INT NOT NULL,
    action VARCHAR(32) NOT NULL,
    operator_id BIGINT NOT NULL,
    operator_name VARCHAR(64) NOT NULL,
    comment VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ds_document_permission (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_code VARCHAR(32) NOT NULL,
    permissions_json TEXT NOT NULL,
    inherited_from VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ds_parse_engine_binding (
    id BIGSERIAL PRIMARY KEY,
    file_extension VARCHAR(32) NOT NULL,
    engine_code VARCHAR(128) NOT NULL,
    engine_name VARCHAR(128) NOT NULL,
    is_default SMALLINT NOT NULL DEFAULT 0,
    enabled SMALLINT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_parse_engine_binding UNIQUE (file_extension, engine_code)
);

CREATE TABLE ds_document_parse_artifact (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    version INT NOT NULL,
    artifact_type VARCHAR(32) NOT NULL,
    artifact_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    page_no INT,
    sequence_no INT,
    storage_bucket VARCHAR(128) NOT NULL,
    storage_object VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_menu (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT,
    code VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL,
    route_key VARCHAR(64),
    icon VARCHAR(64),
    sort_order INT NOT NULL DEFAULT 0,
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_role (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL,
    description VARCHAR(255),
    enabled SMALLINT NOT NULL DEFAULT 1,
    built_in SMALLINT NOT NULL DEFAULT 0,
    admin_role SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_user_role (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_sys_user_role UNIQUE (user_id, role_id)
);

CREATE TABLE sys_role_permission (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL,
    menu_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_sys_role_permission UNIQUE (role_id, menu_id)
);

CREATE TABLE sys_permission_audit (
    id BIGSERIAL PRIMARY KEY,
    target_type VARCHAR(32) NOT NULL,
    target_id BIGINT NOT NULL,
    target_name VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    operator_id BIGINT NOT NULL,
    operator_name VARCHAR(64) NOT NULL,
    detail_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ds_position (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    department_id BIGINT,
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ds_ai_employee (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    position_code VARCHAR(64),
    department_id BIGINT,
    enabled SMALLINT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_acl_policy (
    id BIGSERIAL PRIMARY KEY,
    policy_name VARCHAR(128) NOT NULL,
    security_level VARCHAR(32) NOT NULL DEFAULT 'internal',
    acl_version INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_acl_binding (
    id BIGSERIAL PRIMARY KEY,
    policy_id BIGINT NOT NULL,
    principal_type VARCHAR(32) NOT NULL,
    principal_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    effect VARCHAR(16) NOT NULL DEFAULT 'allow',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_wiki_template (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    schema_json TEXT,
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_wiki_page (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    page_type VARCHAR(64) NOT NULL DEFAULT 'general',
    summary VARCHAR(500),
    content TEXT NOT NULL DEFAULT '',
    metadata_json TEXT,
    tags_json TEXT,
    owner_id BIGINT,
    department_id BIGINT,
    acl_policy_id BIGINT,
    current_version INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    sync_status VARCHAR(32) NOT NULL DEFAULT 'not_indexed',
    health_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
    heat_score NUMERIC(10, 4) NOT NULL DEFAULT 0,
    deleted SMALLINT NOT NULL DEFAULT 0,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_wiki_page_version (
    id BIGSERIAL PRIMARY KEY,
    page_id BIGINT NOT NULL,
    version INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT,
    author_id BIGINT,
    author_name VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    summary VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_wiki_page_version UNIQUE (page_id, version)
);

CREATE TABLE ks_wiki_relation (
    id BIGSERIAL PRIMARY KEY,
    source_page_id BIGINT NOT NULL,
    target_page_id BIGINT NOT NULL,
    relation_type VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_knowledge_object (
    id BIGSERIAL PRIMARY KEY,
    page_id BIGINT,
    object_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    metadata_json TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_chunk (
    id BIGSERIAL PRIMARY KEY,
    source_type VARCHAR(32) NOT NULL,
    source_id BIGINT NOT NULL,
    source_version INT NOT NULL,
    wiki_page_id BIGINT,
    wiki_page_version INT,
    content_hash VARCHAR(64) NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_summary TEXT,
    metadata_json TEXT,
    acl_policy_id BIGINT,
    acl_version INT NOT NULL DEFAULT 1,
    security_level VARCHAR(32) NOT NULL DEFAULT 'internal',
    position_tags TEXT,
    department_tags TEXT,
    project_tags TEXT,
    knowledge_status VARCHAR(32) NOT NULL DEFAULT 'active',
    embedding_model VARCHAR(128),
    embedding_version VARCHAR(64),
    embedding vector(1024),
    index_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_index_record (
    id BIGSERIAL PRIMARY KEY,
    source_type VARCHAR(32) NOT NULL,
    source_id BIGINT NOT NULL,
    source_version INT NOT NULL,
    wiki_page_id BIGINT,
    wiki_page_version INT,
    content_hash VARCHAR(64),
    chunk_strategy_version VARCHAR(64) NOT NULL DEFAULT 'v1',
    chunk_count INT NOT NULL DEFAULT 0,
    embedding_model VARCHAR(128),
    embedding_version VARCHAR(64),
    index_version INT NOT NULL DEFAULT 1,
    index_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    index_error TEXT,
    indexed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_sync_job (
    id BIGSERIAL PRIMARY KEY,
    source_type VARCHAR(32) NOT NULL,
    source_id BIGINT NOT NULL,
    source_version INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    attempt_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    requested_by BIGINT,
    requested_by_name VARCHAR(64),
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_position_package (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    position_code VARCHAR(64),
    default_scope_json TEXT,
    rules_json TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_position_package_item (
    id BIGSERIAL PRIMARY KEY,
    package_id BIGINT NOT NULL,
    item_type VARCHAR(32) NOT NULL DEFAULT 'wiki_page',
    item_id BIGINT NOT NULL,
    required SMALLINT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_usage_event (
    id BIGSERIAL PRIMARY KEY,
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    target_type VARCHAR(32),
    target_id VARCHAR(64),
    task_type VARCHAR(64),
    success SMALLINT,
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_citation_log (
    id BIGSERIAL PRIMARY KEY,
    trace_id VARCHAR(64) NOT NULL,
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    chunk_id BIGINT,
    wiki_page_id BIGINT,
    wiki_page_version INT,
    score NUMERIC(10, 6),
    rerank_score NUMERIC(10, 6),
    permission_matched_by VARCHAR(64),
    task_type VARCHAR(64),
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_health_issue (
    id BIGSERIAL PRIMARY KEY,
    issue_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'medium',
    related_page_id BIGINT,
    related_chunk_id BIGINT,
    owner_id BIGINT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    suggested_action TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    detected_by VARCHAR(64) NOT NULL DEFAULT 'system',
    resolved_by BIGINT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_health_report (
    id BIGSERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    health_score INT NOT NULL,
    summary TEXT,
    metrics_json TEXT,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_maintenance_window (
    id BIGSERIAL PRIMARY KEY,
    status VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    started_by BIGINT,
    ended_by BIGINT,
    reason VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_document_status ON ds_document(status);
CREATE INDEX idx_document_department ON ds_document(department_id);
CREATE INDEX idx_document_folder ON ds_document(folder_id);
CREATE INDEX idx_document_version_document ON ds_document_version(document_id);
CREATE INDEX idx_parse_engine_binding_lookup ON ds_parse_engine_binding(file_extension, enabled, is_default, sort_order);
CREATE INDEX idx_parse_artifact_doc_version ON ds_document_parse_artifact(document_id, version, artifact_type, page_no, sequence_no);
CREATE INDEX idx_sys_menu_parent ON sys_menu(parent_id, sort_order);
CREATE INDEX idx_chunk_page ON ks_chunk(wiki_page_id, wiki_page_version, knowledge_status);
CREATE INDEX idx_chunk_embedding ON ks_chunk USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_citation_trace ON ks_citation_log(trace_id);

INSERT INTO ds_department(id, parent_id, name) VALUES
    (1, NULL, '产品研发中心'),
    (2, 1, '后端组'),
    (3, 1, '前端组'),
    (4, 1, '基础架构组')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ds_user(id, username, display_name, email, password_hash, role_code, department_id, enabled) VALUES
    (1, 'zhangsan', '张三', 'admin@docspace.local', '{noop}Admin@123', 'ADMIN', 2, 1),
    (2, 'lisi', '李四', 'member@docspace.local', '{noop}Member@123', 'MEMBER', 2, 1),
    (3, 'frontend', '王五', 'frontend@docspace.local', '{noop}Member@123', 'MEMBER', 3, 1),
    (4, 'platform', '赵六', 'platform@docspace.local', '{noop}Member@123', 'MEMBER', 4, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ds_folder(id, name, department_id, parent_id, created_by) VALUES
    (1, '架构设计', 2, NULL, 1),
    (2, 'API 文档', 2, NULL, 1),
    (3, '设计系统', 3, NULL, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sys_role(id, code, name, description, enabled, built_in, admin_role) VALUES
    (1, 'ADMIN', '管理员', '系统内置管理员角色', 1, 1, 1),
    (2, 'MEMBER', '普通成员', '系统内置普通成员角色', 1, 1, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sys_menu(id, parent_id, code, name, type, route_key, icon, sort_order, enabled) VALUES
    (1, NULL, 'dashboard.view', '工作台', 'page', 'dashboard', 'dashboard', 10, 1),
    (2, NULL, 'library.view', '文档库', 'page', 'library', 'library', 20, 1),
    (3, NULL, 'search.view', '全局搜索', 'page', 'search', 'search', 30, 1),
    (4, NULL, 'permission_management.view', '权限管理', 'page', 'permission', 'shield', 40, 1),
    (5, 4, 'permission.menu.view', '菜单管理', 'page', 'permission_menus', 'menu', 10, 1),
    (6, 4, 'permission.role.view', '角色管理', 'page', 'permission_roles', 'users', 20, 1),
    (7, 4, 'permission.user.view', '用户管理', 'page', 'permission_users', 'users', 30, 1),
    (8, NULL, 'wiki.view', '知识 Wiki', 'page', 'wiki', 'book-open', 45, 1),
    (9, NULL, 'position_package.view', '岗位知识包', 'page', 'position_packages', 'briefcase', 50, 1),
    (10, NULL, 'knowledge_health.view', '知识健康', 'page', 'knowledge_health', 'activity', 55, 1),
    (11, NULL, 'rag_debug.view', 'RAG 调试台', 'page', 'rag_debug', 'search', 60, 1),
    (12, NULL, 'settings.view', '系统设置', 'page', 'settings', 'settings', 90, 1),
    (13, NULL, 'help.view', '帮助中心', 'page', 'help', 'help', 100, 1),
    (14, 2, 'library.upload', '上传文档', 'action', NULL, NULL, 10, 1),
    (15, 2, 'library.create_folder', '新建文件夹', 'action', NULL, NULL, 20, 1),
    (16, 2, 'document.view', '查看文档', 'action', NULL, NULL, 50, 1),
    (17, 2, 'document.correct', '校正文档', 'action', NULL, NULL, 60, 1),
    (18, 2, 'document.push_rag', '推送知识库', 'action', NULL, NULL, 70, 1),
    (19, 2, 'document.request_audit', '提交审核', 'action', NULL, NULL, 80, 1),
    (20, 2, 'document.publish', '审核发布', 'action', NULL, NULL, 90, 1),
    (21, 2, 'document.reject', '审核驳回', 'action', NULL, NULL, 100, 1),
    (22, 2, 'document.delete', '删除文档', 'action', NULL, NULL, 130, 1),
    (23, 8, 'wiki.edit', '编辑 Wiki', 'action', NULL, NULL, 10, 1),
    (24, 8, 'wiki.publish', '发布 Wiki', 'action', NULL, NULL, 20, 1),
    (25, 9, 'position_package.edit', '编辑岗位知识包', 'action', NULL, NULL, 10, 1),
    (26, 10, 'knowledge_health.maintain', '维护知识健康', 'action', NULL, NULL, 10, 1),
    (27, NULL, 'ai_employee.view', 'AI 员工', 'page', 'ai_employees', 'users', 65, 1),
    (28, 27, 'ai_employee.manage', '管理 AI 员工', 'action', NULL, NULL, 10, 1),
    (29, 4, 'permission.department.view', '部门管理', 'page', 'permission_departments', 'users', 40, 1),
    (30, 12, 'settings.parse_config.view', '解析配置', 'page', 'settings_parse_config', 'settings', 10, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sys_user_role(id, user_id, role_id) VALUES
    (1, 1, 1),
    (2, 2, 2),
    (3, 3, 2),
    (4, 4, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sys_role_permission(role_id, menu_id)
SELECT 1, id FROM sys_menu
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission(role_id, menu_id)
SELECT 2, id
FROM sys_menu
WHERE id IN (1, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18)
ON CONFLICT DO NOTHING;

INSERT INTO ds_parse_engine_binding(file_extension, engine_code, engine_name, is_default, enabled, sort_order) VALUES
    ('pdf', 'apache_pdfbox_java_engine', 'Apache_PDFBox_java_引擎', 1, 1, 10),
    ('docx', 'apache_poi_docx_java_engine', 'Apache_POI_docx_引擎', 1, 1, 20)
ON CONFLICT (file_extension, engine_code) DO NOTHING;

INSERT INTO ds_position(id, code, name, description, department_id) VALUES
    (1, 'product_manager', '产品经理', '负责需求分析、PRD、评审与项目协同。', 1),
    (2, 'architect', '架构师', '负责技术方案、系统边界、风险评估与架构演进。', 2),
    (3, 'test_engineer', '测试工程师', '负责测试策略、测试用例、质量验证与缺陷跟踪。', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ds_ai_employee(id, code, name, description, position_code, department_id) VALUES
    (1, 'ai_pm_001', 'AI 产品经理', '产品经理岗位 AI 员工试点。', 'product_manager', 1),
    (2, 'ai_arch_001', 'AI 架构师', '架构师岗位 AI 员工试点。', 'architect', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ks_acl_policy(id, policy_name, security_level, acl_version, status) VALUES
    (1, '默认内部知识策略', 'internal', 1, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ks_acl_binding(policy_id, principal_type, principal_id, action, effect) VALUES
    (1, 'ROLE', 'ADMIN', 'view', 'allow'),
    (1, 'ROLE', 'MEMBER', 'view', 'allow'),
    (1, 'AI_ROLE', 'product_manager', 'use_in_rag', 'allow'),
    (1, 'AI_ROLE', 'architect', 'use_in_rag', 'allow')
ON CONFLICT DO NOTHING;

INSERT INTO ks_wiki_template(code, name, description, schema_json) VALUES
    ('general', '通用知识', '适用于一般知识沉淀。', '{}'),
    ('sop', 'SOP', '适用于流程和操作手册。', '{}'),
    ('position', '岗位说明书', '适用于岗位职责和工作边界。', '{}')
ON CONFLICT (code) DO NOTHING;

INSERT INTO ks_position_package(id, code, name, description, position_code, default_scope_json, rules_json, status, created_by) VALUES
    (1, 'pkg_product_manager', '产品经理知识包', '产品经理岗位 AI 员工默认知识包。', 'product_manager', '{"tags":["产品","需求","PRD"]}', '{"requireCitation":true}', 'active', 1),
    (2, 'pkg_architect', '架构师知识包', '架构师岗位 AI 员工默认知识包。', 'architect', '{"tags":["架构","技术方案"]}', '{"requireCitation":true}', 'active', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ks_maintenance_window(id, status) VALUES (1, 'NORMAL')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('ds_department','id'), COALESCE((SELECT MAX(id) FROM ds_department), 1), true);
SELECT setval(pg_get_serial_sequence('ds_user','id'), COALESCE((SELECT MAX(id) FROM ds_user), 1), true);
SELECT setval(pg_get_serial_sequence('sys_menu','id'), COALESCE((SELECT MAX(id) FROM sys_menu), 1), true);
SELECT setval(pg_get_serial_sequence('sys_role','id'), COALESCE((SELECT MAX(id) FROM sys_role), 1), true);
SELECT setval(pg_get_serial_sequence('ds_position','id'), COALESCE((SELECT MAX(id) FROM ds_position), 1), true);
SELECT setval(pg_get_serial_sequence('ds_ai_employee','id'), COALESCE((SELECT MAX(id) FROM ds_ai_employee), 1), true);
SELECT setval(pg_get_serial_sequence('ks_acl_policy','id'), COALESCE((SELECT MAX(id) FROM ks_acl_policy), 1), true);
SELECT setval(pg_get_serial_sequence('ks_position_package','id'), COALESCE((SELECT MAX(id) FROM ks_position_package), 1), true);
SELECT setval(pg_get_serial_sequence('ks_maintenance_window','id'), COALESCE((SELECT MAX(id) FROM ks_maintenance_window), 1), true);
