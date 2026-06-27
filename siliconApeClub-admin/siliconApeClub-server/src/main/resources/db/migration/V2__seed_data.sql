INSERT INTO ds_department (id, parent_id, name) VALUES
    (1, NULL, '产品研发中心'),
    (2, 1, '后端组'),
    (3, 1, '前端组'),
    (4, 1, '基础架构组')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO ds_user (id, username, display_name, email, password_hash, role_code, department_id, enabled) VALUES
    (1, 'zhangsan', '张三', 'admin@docspace.local', '{noop}Admin@123', 'ADMIN', 2, 1),
    (2, 'lisi', '李四', 'member@docspace.local', '{noop}Member@123', 'MEMBER', 2, 1),
    (3, 'frontend', '王五', 'frontend@docspace.local', '{noop}Member@123', 'MEMBER', 3, 1),
    (4, 'platform', '赵六', 'platform@docspace.local', '{noop}Member@123', 'MEMBER', 4, 1)
ON DUPLICATE KEY UPDATE
    username = VALUES(username),
    display_name = VALUES(display_name),
    email = VALUES(email),
    password_hash = VALUES(password_hash),
    role_code = VALUES(role_code),
    department_id = VALUES(department_id),
    enabled = VALUES(enabled);

INSERT INTO ds_folder (id, name, department_id, parent_id, created_by) VALUES
    (1, '架构设计', 2, NULL, 1),
    (2, 'API 文档', 2, NULL, 1),
    (3, '设计系统', 3, NULL, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO ds_folder_permission (folder_id, user_id, role_code, permissions_json) VALUES
    (1, 1, 'ADMIN', '["view","edit","upload","delete","manage"]'),
    (1, 2, 'MEMBER', '["view","upload"]'),
    (2, 1, 'ADMIN', '["view","edit","upload","delete","manage"]'),
    (2, 2, 'MEMBER', '["view","upload"]'),
    (3, 1, 'ADMIN', '["view","edit","upload","delete","manage"]'),
    (3, 3, 'MEMBER', '["view","upload"]');

INSERT INTO ds_document
    (id, name, description, tags_json, current_version, live_version, status, department_id, folder_id, latest_source_file, latest_parsed_text,
     parse_status, parse_finished_at, parse_attempt_count, parse_engine, parse_last_run_by,
     rag_status, rag_finished_at, rag_attempt_count, rag_last_run_by,
     rejected_reason, revision_source_document_id, revision_source_version, live_document_id, revision_draft, locked_from_status,
     storage_bucket, storage_object, created_by, deleted)
VALUES
    (1, 'API 核心接口开发规范', '后端核心接口的版本约束与联调规范。', '["后端","API","规范"]', 2, 2, 'PUBLISHED', 2, 2, 'api_spec_v2.pdf',
     '# API 核心接口开发规范\n\n包含鉴权、错误码与版本演进规则。',
     'SUCCESS', NOW(), 1, '通用解析引擎 v2.0', '张三',
     'SUCCESS', NOW(), 1, '张三',
     NULL, NULL, NULL, NULL, 0, NULL,
     'docspace', 'seed/api_spec_v2.pdf', 1, 0),
    (2, '分布式集群架构方案', '高可用与流量治理方案草案。', '["架构","分布式"]', 3, NULL, 'PENDING_AUDIT', 2, 1, 'cluster_arch_v3.docx',
     '# 分布式集群架构方案\n\n当前版本已完成 RAG 同步，等待审核。',
     'SUCCESS', NOW(), 2, '架构增强引擎 v3.0', '李四',
     'SUCCESS', NOW(), 2, '李四',
     NULL, NULL, NULL, NULL, 0, NULL,
     'docspace', 'seed/cluster_arch_v3.docx', 2, 0),
    (3, '数据库迁移排障手册', '最近一次审核被驳回，等待补充回滚方案。', '["数据库","迁移","运维"]', 2, NULL, 'REJECTED', 2, 1, 'db_migration_v2.docx',
     '# 数据库迁移排障手册\n\n当前版本需要补充回滚策略和验收步骤。',
     'SUCCESS', NOW(), 1, '通用解析引擎 v2.0', '李四',
     'SUCCESS', NOW(), 1, '李四',
     '请补充迁移失败后的回滚 SOP，并明确停机窗口。', NULL, NULL, NULL, 0, NULL,
     'docspace', 'seed/db_migration_v2.docx', 2, 0);

INSERT INTO ds_document_version (document_id, version, source_file_name, parsed_content, engine, author, status, summary) VALUES
    (1, 1, 'api_spec_v1.pdf', '# API 核心接口开发规范\n\n初版约束。', '通用解析引擎 v1.5', '张三', 'archived', '历史版本'),
    (1, 2, 'api_spec_v2.pdf', '# API 核心接口开发规范\n\n包含鉴权、错误码与版本演进规则。', '通用解析引擎 v2.0', '张三', 'published', '发布版'),
    (2, 3, 'cluster_arch_v3.docx', '# 分布式集群架构方案\n\n当前版本已完成 RAG 同步，等待审核。', '架构增强引擎 v3.0', '李四', 'draft', '待审核版'),
    (3, 2, 'db_migration_v2.docx', '# 数据库迁移排障手册\n\n当前版本需要补充回滚策略和验收步骤。', '通用解析引擎 v2.0', '李四', 'draft', '已驳回');

INSERT INTO ds_document_audit (document_id, version, action, operator_id, operator_name, comment) VALUES
    (1, 1, 'UPLOAD', 1, '张三', '首次上传'),
    (1, 2, 'PUBLISH', 1, '张三', '发布到生产知识库'),
    (2, 1, 'UPLOAD', 2, '李四', '上传初稿'),
    (2, 3, 'REPARSE', 2, '李四', '切换架构增强引擎'),
    (2, 3, 'SUBMIT', 2, '李四', '等待管理员审核'),
    (3, 1, 'UPLOAD', 2, '李四', '上传并生成草稿'),
    (3, 2, 'SUBMIT', 2, '李四', '提交审核'),
    (3, 2, 'REJECT', 1, '张三', '请补充迁移失败后的回滚 SOP，并明确停机窗口。');

INSERT INTO ds_document_permission (document_id, user_id, role_code, permissions_json) VALUES
    (1, 1, 'ADMIN', '["view","edit","upload","delete","manage","correct","push_rag","request_audit","publish","reject","create_revision","lock"]'),
    (1, 2, 'MEMBER', '["view"]'),
    (2, 1, 'ADMIN', '["view","edit","upload","delete","manage","correct","push_rag","request_audit","publish","reject","create_revision","lock"]'),
    (2, 2, 'MEMBER', '["view","edit","upload","correct","push_rag","request_audit"]'),
    (3, 1, 'ADMIN', '["view","edit","upload","delete","manage","correct","push_rag","request_audit","publish","reject","create_revision","lock"]'),
    (3, 2, 'MEMBER', '["view","edit","upload","correct","push_rag","request_audit"]');
