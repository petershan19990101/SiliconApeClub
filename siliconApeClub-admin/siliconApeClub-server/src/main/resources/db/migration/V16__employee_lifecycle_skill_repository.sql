ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS offline_reason TEXT;
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS left_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS hr_employee_assessment_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    ai_employee_id BIGINT NOT NULL,
    metric_key VARCHAR(64) NOT NULL,
    metric_label VARCHAR(128) NOT NULL,
    metric_type VARCHAR(32) NOT NULL DEFAULT 'count',
    target_value DECIMAL(18, 4) NOT NULL DEFAULT 0,
    weight DECIMAL(8, 4) NOT NULL DEFAULT 1,
    unit VARCHAR(32) NOT NULL DEFAULT 'count',
    enabled TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_hr_employee_assessment_rule (ai_employee_id, metric_key)
);

CREATE TABLE IF NOT EXISTS hr_employee_usage_meter (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    ai_employee_id BIGINT NOT NULL,
    usage_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    source_type VARCHAR(64) NOT NULL DEFAULT 'manual',
    source_id VARCHAR(128),
    input_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    memory_bytes BIGINT NOT NULL DEFAULT 0,
    memory_items BIGINT NOT NULL DEFAULT 0,
    cost_amount DECIMAL(18, 6) NOT NULL DEFAULT 0,
    metadata_json TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hr_employee_usage_meter_employee (ai_employee_id, usage_date)
);

CREATE TABLE IF NOT EXISTS hr_employee_metric_snapshot (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    ai_employee_id BIGINT NOT NULL,
    metric_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    metric_key VARCHAR(64) NOT NULL,
    metric_value DECIMAL(18, 4) NOT NULL DEFAULT 0,
    source_type VARCHAR(64) NOT NULL DEFAULT 'manual',
    source_id VARCHAR(128),
    metadata_json TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hr_employee_metric_snapshot_employee (ai_employee_id, metric_key, metric_date)
);

CREATE TABLE IF NOT EXISTS hr_skill_repository (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(96) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    department_id BIGINT,
    skill_type VARCHAR(64) NOT NULL DEFAULT 'tool',
    skill_level VARCHAR(32) NOT NULL DEFAULT 'basic',
    invocation_mode VARCHAR(32) NOT NULL DEFAULT 'tool_call',
    input_schema_json TEXT,
    output_schema_json TEXT,
    orchestration_config_json TEXT,
    guardrails_json TEXT,
    source_type VARCHAR(32) NOT NULL DEFAULT 'human',
    source_employee_id BIGINT,
    review_status VARCHAR(32) NOT NULL DEFAULT 'draft',
    enabled TINYINT NOT NULL DEFAULT 1,
    created_by VARCHAR(128),
    reviewed_by VARCHAR(128),
    reviewed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hr_skill_repository_department (department_id, review_status, enabled),
    INDEX idx_hr_skill_repository_review (review_status, updated_at)
);

CREATE TABLE IF NOT EXISTS hr_skill_binding (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    ai_employee_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    binding_scope VARCHAR(64) NOT NULL DEFAULT 'employee',
    required TINYINT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    enabled TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_hr_skill_binding (ai_employee_id, skill_id)
);

INSERT INTO hr_skill_repository(
    code, name, description, department_id, skill_type, skill_level, invocation_mode,
    input_schema_json, output_schema_json, orchestration_config_json, guardrails_json,
    source_type, review_status, enabled, created_by
)
VALUES
    ('requirement_breakdown', '需求拆解', '将客户自然语言需求拆解为任务、交付物、风险和所需协作部门。', (SELECT id FROM ds_department WHERE code = 'customer_service'), 'planning', 'basic', 'tool_call', '{"type":"object","properties":{"demand":{"type":"string"},"context":{"type":"object"}},"required":["demand"]}', '{"type":"object","properties":{"tasks":{"type":"array"},"route":{"type":"array"},"risks":{"type":"array"}}}', '{"preferredModelProfile":"default_generalist","maxSteps":4,"allowRag":true}', '{"humanReviewRequired":false,"externalVisible":true}', 'human', 'approved', 1, 'system'),
    ('code_change_review', '代码变更评审', '评审代码改动风险、接口影响、测试缺口和发布注意事项。', (SELECT id FROM ds_department WHERE code = 'public_rd_squad'), 'engineering', 'advanced', 'tool_call', '{"type":"object","properties":{"diff":{"type":"string"},"repoContext":{"type":"string"}},"required":["diff"]}', '{"type":"object","properties":{"findings":{"type":"array"},"riskLevel":{"type":"string"},"testPlan":{"type":"array"}}}', '{"preferredModelProfile":"technology_architect_model","maxSteps":6,"allowRag":true,"allowWiki":true}', '{"humanReviewRequired":true,"topManagerOnly":true}', 'human', 'approved', 1, 'system'),
    ('rag_diagnosis', 'RAG 检索诊断', '分析检索召回、权限命中、Chunk 质量和索引状态。', (SELECT id FROM ds_department WHERE code = 'technology_rd_center'), 'diagnosis', 'basic', 'tool_call', '{"type":"object","properties":{"query":{"type":"string"},"employeeId":{"type":"string"},"aclContext":{"type":"object"}},"required":["query"]}', '{"type":"object","properties":{"matchedChunks":{"type":"array"},"permissionTrace":{"type":"array"},"suggestions":{"type":"array"}}}', '{"preferredModelProfile":"technology_architect_model","maxSteps":5,"allowRag":true}', '{"humanReviewRequired":false}', 'human', 'approved', 1, 'system')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    department_id = VALUES(department_id),
    skill_type = VALUES(skill_type),
    skill_level = VALUES(skill_level),
    invocation_mode = VALUES(invocation_mode),
    input_schema_json = VALUES(input_schema_json),
    output_schema_json = VALUES(output_schema_json),
    orchestration_config_json = VALUES(orchestration_config_json),
    guardrails_json = VALUES(guardrails_json),
    source_type = VALUES(source_type),
    review_status = VALUES(review_status),
    enabled = VALUES(enabled);

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
VALUES (NULL, 'skill_repository.view', '技能仓库', 'page', 'skill_repository', 'wrench', 67, 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    route_key = VALUES(route_key),
    icon = VALUES(icon),
    sort_order = VALUES(sort_order),
    enabled = VALUES(enabled);

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT page.id, 'skill_repository.manage', '管理技能仓库', 'action', NULL, NULL, 10, 1
FROM sys_menu page
WHERE page.code = 'skill_repository.view'
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    parent_id = VALUES(parent_id);

INSERT INTO sys_role_permission(role_id, menu_id)
SELECT role.id, menu.id
FROM sys_role role
JOIN sys_menu menu
WHERE (role.admin_role = 1 OR role.code = 'ADMIN')
  AND menu.code IN ('skill_repository.view', 'skill_repository.manage')
  AND NOT EXISTS (
      SELECT 1
      FROM sys_role_permission permission
      WHERE permission.role_id = role.id
        AND permission.menu_id = menu.id
  );
