ALTER TABLE ds_department ADD COLUMN IF NOT EXISTS code VARCHAR(64);
ALTER TABLE ds_department ADD COLUMN IF NOT EXISTS unit_type VARCHAR(32) NOT NULL DEFAULT 'department';
ALTER TABLE ds_department ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ds_department ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE ds_department ADD COLUMN IF NOT EXISTS enabled SMALLINT NOT NULL DEFAULT 1;

UPDATE ds_department
SET code = 'department_' || id
WHERE code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ds_department_code ON ds_department(code);

ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS role_title VARCHAR(128);
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS responsibilities TEXT;
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS skills_json TEXT;
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS contact_relations_json TEXT;
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS memory_policy_json TEXT;
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS model_config_json TEXT;
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS hr_role_code VARCHAR(64);
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS manager_employee_id BIGINT;
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS employment_type VARCHAR(32) NOT NULL DEFAULT 'ai_employee';
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS cost_rate NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE ds_ai_employee ADD COLUMN IF NOT EXISTS performance_status VARCHAR(32) NOT NULL DEFAULT 'trial';

CREATE TABLE IF NOT EXISTS hr_role (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    permissions_json TEXT,
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_employee_role (
    id BIGSERIAL PRIMARY KEY,
    ai_employee_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_hr_employee_role UNIQUE (ai_employee_id, role_id)
);

CREATE TABLE IF NOT EXISTS hr_employee_contact_relation (
    id BIGSERIAL PRIMARY KEY,
    ai_employee_id BIGINT NOT NULL,
    related_employee_id BIGINT NOT NULL,
    relation_type VARCHAR(64) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_hr_employee_contact_relation UNIQUE (ai_employee_id, related_employee_id, relation_type)
);

CREATE TABLE IF NOT EXISTS hr_model_profile (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    model_name VARCHAR(128) NOT NULL,
    purpose TEXT,
    config_json TEXT,
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_member (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    customer_type VARCHAR(32) NOT NULL DEFAULT 'external',
    principal_code VARCHAR(64),
    contact_name VARCHAR(128),
    contact_email VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_role (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    permissions_json TEXT,
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_role_binding (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_customer_role_binding UNIQUE (customer_id, role_id)
);

CREATE TABLE IF NOT EXISTS customer_department_visibility (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    department_id BIGINT NOT NULL,
    visibility_type VARCHAR(32) NOT NULL DEFAULT 'visible',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_customer_department_visibility UNIQUE (customer_id, department_id)
);

CREATE TABLE IF NOT EXISTS customer_employee_visibility (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    ai_employee_id BIGINT NOT NULL,
    visibility_type VARCHAR(32) NOT NULL DEFAULT 'visible',
    can_consult SMALLINT NOT NULL DEFAULT 1,
    can_assign SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_customer_employee_visibility UNIQUE (customer_id, ai_employee_id)
);

INSERT INTO ds_department(code, parent_id, name, unit_type, description, sort_order)
VALUES
    ('sac_company', NULL, '硅基猿猴俱乐部', 'company', 'AI 员工公司主体。', 1),
    ('business_strategy', (SELECT id FROM ds_department WHERE code = 'sac_company'), '业务战略部', 'department', '分析研发业务发展，制定企业业务发展战略。', 10),
    ('customer_service', (SELECT id FROM ds_department WHERE code = 'sac_company'), '客户服务部', 'department', '汇总客服数据，直接对接外部客户需求。', 20),
    ('marketing', (SELECT id FROM ds_department WHERE code = 'sac_company'), '市场部', 'department', '提出总体市场竞争、揽客和市场策略方案。', 30),
    ('technology', (SELECT id FROM ds_department WHERE code = 'sac_company'), '科技部', 'department', '负责公司全部信息数字化建设、运维和安全。', 40),
    ('technology_rd_center', (SELECT id FROM ds_department WHERE code = 'technology'), '研发中心', 'center', '负责技术研发和业务对接战队管理。', 41),
    ('public_rd_squad', (SELECT id FROM ds_department WHERE code = 'technology_rd_center'), '公共研发战队', 'squad', '当前公共研发业务对接战队。', 42),
    ('technology_ops_center', (SELECT id FROM ds_department WHERE code = 'technology'), '运维中心', 'center', '负责系统发布、重启和运行维护。', 43),
    ('technology_security_center', (SELECT id FROM ds_department WHERE code = 'technology'), '安全中心', 'center', '负责架构安全评估和安全治理。', 44)
ON CONFLICT (code) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    unit_type = EXCLUDED.unit_type,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO ds_position(code, name, description, department_id)
VALUES
    ('chief_strategist', '首席战略师', '定期输出战略报告，制定公司方向。', (SELECT id FROM ds_department WHERE code = 'business_strategy')),
    ('strategy_researcher', '战略研究员', '辅助战略师完成具体研究事项。', (SELECT id FROM ds_department WHERE code = 'business_strategy')),
    ('customer_service_leader', '客户服务部 Leader', '汇总月度客服数据，管理客服专员。', (SELECT id FROM ds_department WHERE code = 'customer_service')),
    ('customer_service_specialist', '客服专员', '直接对接外部客户需求。', (SELECT id FROM ds_department WHERE code = 'customer_service')),
    ('marketing_leader', '市场部 Leader', '汇总市场竞争和揽客方案。', (SELECT id FROM ds_department WHERE code = 'marketing')),
    ('marketing_product_manager', '市场专员/产品经理', '负责市场事项分析，并将市场策略转化为科技建设需求。', (SELECT id FROM ds_department WHERE code = 'marketing')),
    ('cto', 'CTO', '汇总公司整体信息数字化建设方案。', (SELECT id FROM ds_department WHERE code = 'technology')),
    ('rd_center_leader', '研发中心负责人', '负责研发中心和战队交付。', (SELECT id FROM ds_department WHERE code = 'technology_rd_center')),
    ('public_rd_squad_leader', '公共研发战队队长', '负责公共研发战队任务分派和交付。', (SELECT id FROM ds_department WHERE code = 'public_rd_squad')),
    ('developer', '研发人员', '负责具体研发任务。', (SELECT id FROM ds_department WHERE code = 'public_rd_squad')),
    ('ops_center_leader', '运维中心负责人', '负责系统发布、重启和运维实施。', (SELECT id FROM ds_department WHERE code = 'technology_ops_center')),
    ('security_center_leader', '安全中心负责人', '负责架构安全评估。', (SELECT id FROM ds_department WHERE code = 'technology_security_center'))
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    department_id = EXCLUDED.department_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO hr_role(code, name, description, permissions_json)
VALUES
    ('leader', 'Leader', '部门或中心负责人，可接收汇总类任务并进行任务拆分。', '{"assign_employee":true,"review_task":true}'),
    ('specialist', '专员', '负责具体任务执行和沉淀。', '{"consult_employee":true}'),
    ('frontdesk', '业务前台', '接待外部客户并进行需求澄清、组织路由。', '{"consult_employee":true,"intake_customer":true}'),
    ('researcher', '研究员', '负责研究分析和报告素材整理。', '{"consult_employee":true}'),
    ('product_manager', '产品经理', '将市场策略转化为科技建设需求。', '{"create_tech_demand":true}'),
    ('engineer', '工程师', '负责研发、运维或安全实施。', '{"execute_task":true}')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    permissions_json = EXCLUDED.permissions_json,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO hr_model_profile(code, name, provider, model_name, purpose, config_json)
VALUES
    ('default_generalist', '通用任务模型', 'external', 'default-generalist', '客服、需求澄清和通用任务。', '{"temperature":0.3}'),
    ('strategy_research_model', '战略研究模型', 'external', 'strategy-research', '战略研究、市场研判和报告。', '{"temperature":0.2}'),
    ('technology_architect_model', '技术架构模型', 'external', 'technology-architect', '研发、运维、安全和架构评估。', '{"temperature":0.1}')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    provider = EXCLUDED.provider,
    model_name = EXCLUDED.model_name,
    purpose = EXCLUDED.purpose,
    config_json = EXCLUDED.config_json,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO ds_ai_employee(code, name, description, position_code, department_id, role_title, responsibilities, skills_json, hr_role_code, model_config_json, cost_rate, performance_status)
VALUES
    ('frontdesk-ada', '业务前台 Ada', '统一接待外部客户需求并完成组织路由。', 'customer_service_specialist', (SELECT id FROM ds_department WHERE code = 'customer_service'), '业务前台人员', '接待客户、澄清需求、登记结构化表单、按组织关系派发任务。', '["需求接待","结构化表单","组织路由","任务建账"]', 'frontdesk', '{"modelProfileCode":"default_generalist"}', 30, 'active'),
    ('strategy-chief', '首席战略师 Yuan', '定期输出战略报告，制定公司方向。', 'chief_strategist', (SELECT id FROM ds_department WHERE code = 'business_strategy'), '业务战略部 Leader / 首席战略师', '分析研发业务发展，制定企业业务发展战略，定期输出战略报告。', '["战略分析","行业研究","战略报告","方向制定"]', 'leader', '{"modelProfileCode":"strategy_research_model"}', 120, 'active'),
    ('strategy-researcher-01', '战略研究员 Qing', '辅助首席战略师完成研究事项。', 'strategy_researcher', (SELECT id FROM ds_department WHERE code = 'business_strategy'), '战略研究员', '收集资料、整理研究假设、输出研究素材。', '["资料收集","竞品研究","数据摘要"]', 'researcher', '{"modelProfileCode":"strategy_research_model"}', 60, 'trial'),
    ('strategy-researcher-02', '战略研究员 Sen', '辅助首席战略师完成研究事项。', 'strategy_researcher', (SELECT id FROM ds_department WHERE code = 'business_strategy'), '战略研究员', '收集资料、整理研究假设、输出研究素材。', '["资料收集","趋势分析","报告辅助"]', 'researcher', '{"modelProfileCode":"strategy_research_model"}', 60, 'trial'),
    ('customer-service-leader', '客户服务 Leader Mei', '汇总月度客服数据，管理客服专员。', 'customer_service_leader', (SELECT id FROM ds_department WHERE code = 'customer_service'), '客户服务部 Leader', '汇总月度客服数据，管理客服专员，升级复杂客户需求。', '["客服数据汇总","客户分层","服务质量复盘"]', 'leader', '{"modelProfileCode":"default_generalist"}', 80, 'active'),
    ('customer-service-01', '客服专员 Yi', '直接对接外部客户需求。', 'customer_service_specialist', (SELECT id FROM ds_department WHERE code = 'customer_service'), '客服专员', '接待客户、记录需求、跟进反馈。', '["客户沟通","需求记录","反馈跟进"]', 'specialist', '{"modelProfileCode":"default_generalist"}', 35, 'active'),
    ('customer-service-02', '客服专员 An', '直接对接外部客户需求。', 'customer_service_specialist', (SELECT id FROM ds_department WHERE code = 'customer_service'), '客服专员', '接待客户、记录需求、跟进反馈。', '["客户沟通","需求记录","反馈跟进"]', 'specialist', '{"modelProfileCode":"default_generalist"}', 35, 'active'),
    ('marketing-leader', '市场 Leader Nuo', '汇总市场竞争和揽客方案。', 'marketing_leader', (SELECT id FROM ds_department WHERE code = 'marketing'), '市场部 Leader', '提出总体市场竞争、获客和市场策略方案。', '["市场竞争","获客方案","营销策略"]', 'leader', '{"modelProfileCode":"strategy_research_model"}', 85, 'active'),
    ('marketing-pm-01', '市场产品经理 Lan', '市场专员兼产品经理。', 'marketing_product_manager', (SELECT id FROM ds_department WHERE code = 'marketing'), '市场专员 / 产品经理', '负责具体市场事项分析，转化市场策略为科技建设需求。', '["市场分析","产品需求","PRD 草案"]', 'product_manager', '{"modelProfileCode":"strategy_research_model"}', 55, 'trial'),
    ('marketing-pm-02', '市场产品经理 Tao', '市场专员兼产品经理。', 'marketing_product_manager', (SELECT id FROM ds_department WHERE code = 'marketing'), '市场专员 / 产品经理', '负责具体市场事项分析，转化市场策略为科技建设需求。', '["市场分析","产品需求","PRD 草案"]', 'product_manager', '{"modelProfileCode":"strategy_research_model"}', 55, 'trial'),
    ('cto-luo', 'CTO Luo', '负责公司整体信息数字化建设方案汇总。', 'cto', (SELECT id FROM ds_department WHERE code = 'technology'), 'CTO', '统筹信息数字化建设、研发、运维和安全方案。', '["数字化规划","技术架构","建设路线图"]', 'leader', '{"modelProfileCode":"technology_architect_model"}', 150, 'active'),
    ('rd-leader', '研发中心负责人 Chen', '负责研发中心和战队交付。', 'rd_center_leader', (SELECT id FROM ds_department WHERE code = 'technology_rd_center'), '研发中心负责人', '管理研发中心，协调业务对接战队。', '["研发管理","技术方案","任务拆解"]', 'leader', '{"modelProfileCode":"technology_architect_model"}', 110, 'active'),
    ('public-rd-captain', '公共研发战队队长 Rui', '负责公共研发战队任务分派和交付。', 'public_rd_squad_leader', (SELECT id FROM ds_department WHERE code = 'public_rd_squad'), '公共研发战队队长', '承接科技建设需求，拆分研发任务并组织交付。', '["研发排期","代码实现","技术评审"]', 'leader', '{"modelProfileCode":"technology_architect_model"}', 95, 'active'),
    ('developer-01', '研发工程师 Xing', '公共研发战队研发人员。', 'developer', (SELECT id FROM ds_department WHERE code = 'public_rd_squad'), '研发人员', '完成具体研发事项。', '["后端开发","接口联调","单元测试"]', 'engineer', '{"modelProfileCode":"technology_architect_model"}', 70, 'trial'),
    ('developer-02', '研发工程师 Yu', '公共研发战队研发人员。', 'developer', (SELECT id FROM ds_department WHERE code = 'public_rd_squad'), '研发人员', '完成具体研发事项。', '["前端开发","交互实现","构建验证"]', 'engineer', '{"modelProfileCode":"technology_architect_model"}', 70, 'trial'),
    ('ops-engineer-01', '运维工程师 Wei', '负责系统发布重启等工作。', 'ops_center_leader', (SELECT id FROM ds_department WHERE code = 'technology_ops_center'), '运维人员', '实施系统发布、重启、巡检和运行维护。', '["Docker 部署","服务重启","日志排查"]', 'engineer', '{"modelProfileCode":"technology_architect_model"}', 75, 'active'),
    ('security-specialist-01', '安全专员 Ning', '负责评估架构安全。', 'security_center_leader', (SELECT id FROM ds_department WHERE code = 'technology_security_center'), '安全专员', '评估架构安全、权限风险和合规边界。', '["架构安全","权限评估","风险清单"]', 'engineer', '{"modelProfileCode":"technology_architect_model"}', 80, 'active')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    position_code = EXCLUDED.position_code,
    department_id = EXCLUDED.department_id,
    role_title = EXCLUDED.role_title,
    responsibilities = EXCLUDED.responsibilities,
    skills_json = EXCLUDED.skills_json,
    hr_role_code = EXCLUDED.hr_role_code,
    model_config_json = EXCLUDED.model_config_json,
    cost_rate = EXCLUDED.cost_rate,
    performance_status = EXCLUDED.performance_status,
    enabled = 1,
    status = 'ACTIVE',
    updated_at = CURRENT_TIMESTAMP;

UPDATE ds_ai_employee e
SET manager_employee_id = leader.id
FROM ds_ai_employee leader
WHERE e.code IN ('strategy-researcher-01', 'strategy-researcher-02')
  AND leader.code = 'strategy-chief';

UPDATE ds_ai_employee e
SET manager_employee_id = leader.id
FROM ds_ai_employee leader
WHERE e.code IN ('frontdesk-ada', 'customer-service-01', 'customer-service-02')
  AND leader.code = 'customer-service-leader';

UPDATE ds_ai_employee e
SET manager_employee_id = leader.id
FROM ds_ai_employee leader
WHERE e.code IN ('marketing-pm-01', 'marketing-pm-02')
  AND leader.code = 'marketing-leader';

UPDATE ds_ai_employee e
SET manager_employee_id = leader.id
FROM ds_ai_employee leader
WHERE e.code IN ('rd-leader', 'ops-engineer-01', 'security-specialist-01')
  AND leader.code = 'cto-luo';

UPDATE ds_ai_employee e
SET manager_employee_id = leader.id
FROM ds_ai_employee leader
WHERE e.code IN ('public-rd-captain')
  AND leader.code = 'rd-leader';

UPDATE ds_ai_employee e
SET manager_employee_id = leader.id
FROM ds_ai_employee leader
WHERE e.code IN ('developer-01', 'developer-02')
  AND leader.code = 'public-rd-captain';

INSERT INTO hr_employee_role(ai_employee_id, role_id)
SELECT e.id, r.id
FROM ds_ai_employee e
JOIN hr_role r ON r.code = e.hr_role_code
ON CONFLICT (ai_employee_id, role_id) DO NOTHING;

INSERT INTO hr_employee_contact_relation(ai_employee_id, related_employee_id, relation_type, description)
SELECT source.id, target.id, relation.relation_type, relation.description
FROM (
    VALUES
        ('frontdesk-ada', 'customer-service-leader', 'reports_to', '业务前台向客户服务 Leader 汇报。'),
        ('frontdesk-ada', 'marketing-leader', 'consults', '客户需求中的市场问题可咨询市场部。'),
        ('frontdesk-ada', 'rd-leader', 'routes_to', '技术建设需求可路由到研发中心。'),
        ('marketing-pm-01', 'rd-leader', 'creates_demand_for', '市场策略转化为科技建设需求。'),
        ('marketing-pm-02', 'rd-leader', 'creates_demand_for', '市场策略转化为科技建设需求。'),
        ('rd-leader', 'public-rd-captain', 'manages', '研发中心负责人管理公共研发战队。'),
        ('cto-luo', 'security-specialist-01', 'reviews_with', 'CTO 与安全专员共同评估架构安全。')
) AS relation(source_code, target_code, relation_type, description)
JOIN ds_ai_employee source ON source.code = relation.source_code
JOIN ds_ai_employee target ON target.code = relation.target_code
ON CONFLICT (ai_employee_id, related_employee_id, relation_type) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO customer_role(code, name, description, permissions_json)
VALUES
    ('external_customer', '外部客户', '普通外部客户，可查看维护中心授权的部门和员工。', '{"view_visible_departments":true,"consult_visible_employee":true}'),
    ('strategic_customer', '战略客户', '战略客户，可查看更多协作部门并获得优先接待。', '{"view_visible_departments":true,"consult_visible_employee":true,"priority_intake":true}')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    permissions_json = EXCLUDED.permissions_json,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO customer_member(code, name, customer_type, principal_code, contact_name, contact_email, metadata_json)
VALUES
    ('demo_customer', '演示客户公司', 'external', 'customer', '客户代表', 'customer@example.com', '{"source":"seed","level":"external_customer"}')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    customer_type = EXCLUDED.customer_type,
    principal_code = EXCLUDED.principal_code,
    contact_name = EXCLUDED.contact_name,
    contact_email = EXCLUDED.contact_email,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO customer_role_binding(customer_id, role_id)
SELECT c.id, r.id
FROM customer_member c
JOIN customer_role r ON r.code = 'external_customer'
WHERE c.code = 'demo_customer'
ON CONFLICT (customer_id, role_id) DO NOTHING;

INSERT INTO customer_department_visibility(customer_id, department_id)
SELECT c.id, d.id
FROM customer_member c
JOIN ds_department d ON d.code IN ('customer_service', 'marketing', 'technology_rd_center')
WHERE c.code = 'demo_customer'
ON CONFLICT (customer_id, department_id) DO NOTHING;

INSERT INTO customer_employee_visibility(customer_id, ai_employee_id, can_consult, can_assign)
SELECT c.id, e.id,
       CASE WHEN e.code IN ('frontdesk-ada', 'customer-service-01', 'customer-service-02', 'marketing-pm-01', 'marketing-pm-02') THEN 1 ELSE 0 END,
       0
FROM customer_member c
JOIN ds_ai_employee e ON e.code IN ('frontdesk-ada', 'customer-service-01', 'customer-service-02', 'marketing-pm-01', 'marketing-pm-02')
WHERE c.code = 'demo_customer'
ON CONFLICT (customer_id, ai_employee_id) DO UPDATE SET
    can_consult = EXCLUDED.can_consult,
    can_assign = EXCLUDED.can_assign;

UPDATE sys_menu
SET name = '组织与人力中心', code = 'organization_hr.view', icon = 'users', updated_at = CURRENT_TIMESTAMP
WHERE route_key = 'ai_employees' OR code = 'ai_employee.view';

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
VALUES (NULL, 'customer_member.view', '客户会员中心', 'page', 'customer_members', 'users', 68, 1)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    route_key = EXCLUDED.route_key,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT page.id, 'organization_hr.manage', '管理组织与人力', 'action', NULL, NULL, 10, 1
FROM sys_menu page
WHERE page.code = 'organization_hr.view'
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT page.id, 'customer_member.manage', '管理客户会员', 'action', NULL, NULL, 10, 1
FROM sys_menu page
WHERE page.code = 'customer_member.view'
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_role_permission(role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
CROSS JOIN sys_menu m
WHERE r.admin_role = 1
  AND m.code IN ('organization_hr.view', 'organization_hr.manage', 'customer_member.view', 'customer_member.manage')
ON CONFLICT (role_id, menu_id) DO NOTHING;
