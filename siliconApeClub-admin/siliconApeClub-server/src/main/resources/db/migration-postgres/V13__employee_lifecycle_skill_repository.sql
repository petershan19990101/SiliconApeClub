ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS offline_reason TEXT;
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS left_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS hr_employee_assessment_rule (
    id BIGSERIAL PRIMARY KEY,
    ai_employee_id BIGINT NOT NULL,
    metric_key VARCHAR(64) NOT NULL,
    metric_label VARCHAR(128) NOT NULL,
    metric_type VARCHAR(32) NOT NULL DEFAULT 'count',
    target_value NUMERIC(18, 4) NOT NULL DEFAULT 0,
    weight NUMERIC(8, 4) NOT NULL DEFAULT 1,
    unit VARCHAR(32) NOT NULL DEFAULT 'count',
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_hr_employee_assessment_rule UNIQUE (ai_employee_id, metric_key)
);

CREATE TABLE IF NOT EXISTS hr_employee_usage_meter (
    id BIGSERIAL PRIMARY KEY,
    ai_employee_id BIGINT NOT NULL,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source_type VARCHAR(64) NOT NULL DEFAULT 'manual',
    source_id VARCHAR(128),
    input_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    memory_bytes BIGINT NOT NULL DEFAULT 0,
    memory_items BIGINT NOT NULL DEFAULT 0,
    cost_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_usage_meter_employee ON hr_employee_usage_meter(ai_employee_id, usage_date DESC);

CREATE TABLE IF NOT EXISTS hr_employee_metric_snapshot (
    id BIGSERIAL PRIMARY KEY,
    ai_employee_id BIGINT NOT NULL,
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    metric_key VARCHAR(64) NOT NULL,
    metric_value NUMERIC(18, 4) NOT NULL DEFAULT 0,
    source_type VARCHAR(64) NOT NULL DEFAULT 'manual',
    source_id VARCHAR(128),
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_metric_snapshot_employee ON hr_employee_metric_snapshot(ai_employee_id, metric_key, metric_date DESC);

CREATE TABLE IF NOT EXISTS hr_skill_repository (
    id BIGSERIAL PRIMARY KEY,
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
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_by VARCHAR(128),
    reviewed_by VARCHAR(128),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hr_skill_repository_department ON hr_skill_repository(department_id, review_status, enabled);
CREATE INDEX IF NOT EXISTS idx_hr_skill_repository_review ON hr_skill_repository(review_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS hr_skill_binding (
    id BIGSERIAL PRIMARY KEY,
    ai_employee_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    binding_scope VARCHAR(64) NOT NULL DEFAULT 'employee',
    required SMALLINT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_hr_skill_binding UNIQUE (ai_employee_id, skill_id)
);

INSERT INTO hr_skill_repository(
    code, name, description, department_id, skill_type, skill_level, invocation_mode,
    input_schema_json, output_schema_json, orchestration_config_json, guardrails_json,
    source_type, review_status, enabled, created_by
)
VALUES
    (
        'requirement_breakdown',
        '需求拆解',
        '将客户自然语言需求拆解为任务、交付物、风险和所需协作部门。',
        (SELECT id FROM ds_department WHERE code = 'customer_service'),
        'planning',
        'basic',
        'tool_call',
        '{"type":"object","properties":{"demand":{"type":"string"},"context":{"type":"object"}},"required":["demand"]}',
        '{"type":"object","properties":{"tasks":{"type":"array"},"route":{"type":"array"},"risks":{"type":"array"}}}',
        '{"preferredModelProfile":"default_generalist","maxSteps":4,"allowRag":true}',
        '{"humanReviewRequired":false,"externalVisible":true}',
        'human',
        'approved',
        1,
        'system'
    ),
    (
        'code_change_review',
        '代码变更评审',
        '评审代码改动风险、接口影响、测试缺口和发布注意事项。',
        (SELECT id FROM ds_department WHERE code = 'public_rd_squad'),
        'engineering',
        'advanced',
        'tool_call',
        '{"type":"object","properties":{"diff":{"type":"string"},"repoContext":{"type":"string"}},"required":["diff"]}',
        '{"type":"object","properties":{"findings":{"type":"array"},"riskLevel":{"type":"string"},"testPlan":{"type":"array"}}}',
        '{"preferredModelProfile":"technology_architect_model","maxSteps":6,"allowRag":true,"allowWiki":true}',
        '{"humanReviewRequired":true,"topManagerOnly":true}',
        'human',
        'approved',
        1,
        'system'
    ),
    (
        'rag_diagnosis',
        'RAG 检索诊断',
        '分析检索召回、权限命中、Chunk 质量和索引状态。',
        (SELECT id FROM ds_department WHERE code = 'technology_rd_center'),
        'diagnosis',
        'basic',
        'tool_call',
        '{"type":"object","properties":{"query":{"type":"string"},"employeeId":{"type":"string"},"aclContext":{"type":"object"}},"required":["query"]}',
        '{"type":"object","properties":{"matchedChunks":{"type":"array"},"permissionTrace":{"type":"array"},"suggestions":{"type":"array"}}}',
        '{"preferredModelProfile":"technology_architect_model","maxSteps":5,"allowRag":true}',
        '{"humanReviewRequired":false}',
        'human',
        'approved',
        1,
        'system'
    )
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    department_id = EXCLUDED.department_id,
    skill_type = EXCLUDED.skill_type,
    skill_level = EXCLUDED.skill_level,
    invocation_mode = EXCLUDED.invocation_mode,
    input_schema_json = EXCLUDED.input_schema_json,
    output_schema_json = EXCLUDED.output_schema_json,
    orchestration_config_json = EXCLUDED.orchestration_config_json,
    guardrails_json = EXCLUDED.guardrails_json,
    source_type = EXCLUDED.source_type,
    review_status = EXCLUDED.review_status,
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO hr_employee_assessment_rule(ai_employee_id, metric_key, metric_label, metric_type, target_value, weight, unit)
SELECT e.id, rule.metric_key, rule.metric_label, rule.metric_type, rule.target_value, rule.weight, rule.unit
FROM ds_ai_employee e
JOIN (
    VALUES
        ('code_lines', '代码量', 'count', 1000, 0.20, 'line'),
        ('bug_fix_count', '修复 Bug 数', 'count', 8, 0.25, 'item'),
        ('document_count', '文档数量', 'count', 4, 0.20, 'item'),
        ('delivered_requirement_count', '实现需求数量', 'count', 6, 0.35, 'item')
) AS rule(metric_key, metric_label, metric_type, target_value, weight, unit) ON TRUE
WHERE e.position_code IN ('developer', 'public_rd_squad_leader', 'rd_center_leader')
ON CONFLICT (ai_employee_id, metric_key) DO NOTHING;

INSERT INTO hr_employee_assessment_rule(ai_employee_id, metric_key, metric_label, metric_type, target_value, weight, unit)
SELECT e.id, rule.metric_key, rule.metric_label, rule.metric_type, rule.target_value, rule.weight, rule.unit
FROM ds_ai_employee e
JOIN (
    VALUES
        ('requirement_count', '需求数量', 'count', 10, 0.30, 'item'),
        ('bug_report_count', '提出 Bug 数', 'count', 8, 0.25, 'item'),
        ('test_case_count', '用例数量', 'count', 20, 0.25, 'item'),
        ('test_report_count', '测试报告数量', 'count', 4, 0.20, 'item')
) AS rule(metric_key, metric_label, metric_type, target_value, weight, unit) ON TRUE
WHERE e.position_code LIKE '%test%' OR e.role_title LIKE '%测试%'
ON CONFLICT (ai_employee_id, metric_key) DO NOTHING;

INSERT INTO hr_employee_assessment_rule(ai_employee_id, metric_key, metric_label, metric_type, target_value, weight, unit)
SELECT e.id, rule.metric_key, rule.metric_label, rule.metric_type, rule.target_value, rule.weight, rule.unit
FROM ds_ai_employee e
JOIN (
    VALUES
        ('requirement_intake_count', '需求接待数量', 'count', 20, 0.35, 'item'),
        ('route_accuracy_count', '路由准确数量', 'count', 16, 0.35, 'item'),
        ('customer_followup_count', '客户跟进数量', 'count', 20, 0.30, 'item')
) AS rule(metric_key, metric_label, metric_type, target_value, weight, unit) ON TRUE
WHERE e.hr_role_code IN ('frontdesk', 'specialist')
ON CONFLICT (ai_employee_id, metric_key) DO NOTHING;

INSERT INTO hr_skill_binding(ai_employee_id, skill_id, sort_order)
SELECT e.id, s.id, 10
FROM ds_ai_employee e
JOIN hr_skill_repository s ON s.code = 'requirement_breakdown'
WHERE e.code IN ('frontdesk-ada', 'customer-service-leader')
ON CONFLICT (ai_employee_id, skill_id) DO NOTHING;

INSERT INTO hr_skill_binding(ai_employee_id, skill_id, sort_order)
SELECT e.id, s.id, 20
FROM ds_ai_employee e
JOIN hr_skill_repository s ON s.code IN ('code_change_review', 'rag_diagnosis')
WHERE e.code IN ('rd-leader', 'public-rd-captain', 'developer-01', 'developer-02')
ON CONFLICT (ai_employee_id, skill_id) DO NOTHING;

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
VALUES (NULL, 'skill_repository.view', '技能仓库', 'page', 'skill_repository', 'wrench', 67, 1)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    route_key = EXCLUDED.route_key,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT page.id, 'skill_repository.manage', '管理技能仓库', 'action', NULL, NULL, 10, 1
FROM sys_menu page
WHERE page.code = 'skill_repository.view'
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_role_permission(role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
CROSS JOIN sys_menu m
WHERE r.admin_role = 1
  AND m.code IN ('skill_repository.view', 'skill_repository.manage')
ON CONFLICT (role_id, menu_id) DO NOTHING;
