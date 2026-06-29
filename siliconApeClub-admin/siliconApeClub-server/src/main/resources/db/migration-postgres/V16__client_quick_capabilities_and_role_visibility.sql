CREATE TABLE IF NOT EXISTS client_quick_capability_group (
    id BIGSERIAL PRIMARY KEY,
    group_code VARCHAR(80) NOT NULL UNIQUE,
    group_name VARCHAR(120) NOT NULL,
    description TEXT,
    group_sort INT NOT NULL DEFAULT 100,
    visible_to_external SMALLINT NOT NULL DEFAULT 1,
    visible_to_internal SMALLINT NOT NULL DEFAULT 1,
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_quick_capability (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES client_quick_capability_group(id),
    capability_code VARCHAR(100) NOT NULL UNIQUE,
    capability_name VARCHAR(120) NOT NULL,
    description TEXT,
    transaction_service_code VARCHAR(120) NOT NULL,
    action_code VARCHAR(120) NOT NULL,
    form_title VARCHAR(120),
    submit_label VARCHAR(80),
    input_schema_json TEXT NOT NULL DEFAULT '{}',
    display_html TEXT,
    keywords_json TEXT NOT NULL DEFAULT '[]',
    visible_to_external SMALLINT NOT NULL DEFAULT 1,
    visible_to_internal SMALLINT NOT NULL DEFAULT 1,
    enabled SMALLINT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_quick_capability_group ON client_quick_capability(group_id, enabled, sort_order);
CREATE INDEX IF NOT EXISTS idx_client_quick_capability_visibility ON client_quick_capability(enabled, visible_to_external, visible_to_internal);

CREATE TABLE IF NOT EXISTS customer_role_department_visibility (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES customer_role(id),
    department_id BIGINT NOT NULL REFERENCES ds_department(id),
    visibility_type VARCHAR(32) NOT NULL DEFAULT 'visible',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_customer_role_department_visibility UNIQUE (role_id, department_id)
);

CREATE TABLE IF NOT EXISTS customer_role_employee_visibility (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES customer_role(id),
    ai_employee_id BIGINT NOT NULL REFERENCES ds_ai_employee(id),
    visibility_type VARCHAR(32) NOT NULL DEFAULT 'visible',
    can_consult SMALLINT NOT NULL DEFAULT 1,
    can_assign SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_customer_role_employee_visibility UNIQUE (role_id, ai_employee_id)
);

INSERT INTO client_quick_capability_group(group_code, group_name, description, group_sort)
VALUES
    ('order_service', '订单服务', '客户下单、订单查询等交易入口。', 10),
    ('after_sales', '售后服务', '退货、退款和售后登记入口。', 20),
    ('service_support', '服务支持', '服务地址、办理条件等查询入口。', 30)
ON CONFLICT (group_code) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    description = EXCLUDED.description,
    group_sort = EXCLUDED.group_sort,
    enabled = 1,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO client_quick_capability(
    group_id, capability_code, capability_name, description, transaction_service_code, action_code,
    form_title, submit_label, input_schema_json, display_html, keywords_json, sort_order
)
SELECT g.id, seed.capability_code, seed.capability_name, seed.description, seed.transaction_service_code, seed.action_code,
       seed.form_title, seed.submit_label, seed.input_schema_json, seed.display_html, seed.keywords_json, seed.sort_order
FROM client_quick_capability_group g
JOIN (
    VALUES
        ('order_service', 'business_order_create', '业务下单', '收集商品、数量、联系人和收货地址，创建演示订单账本。', 'TRADE_ORDER_CREATE', 'create_order',
         '业务下单', '提交订单',
         '{"title":"业务下单","required":["productName","quantity","deliveryAddress","contactPhone"],"properties":{"productName":{"type":"string","title":"商品/服务名称"},"quantity":{"type":"number","title":"数量","default":1},"deliveryAddress":{"type":"string","title":"收货/服务地址","ui:widget":"textarea"},"contactPhone":{"type":"string","title":"联系电话"},"remark":{"type":"string","title":"备注","ui:widget":"textarea"}}}',
         '<section><h3>业务下单</h3><p>请填写精确入参，提交后创建订单任务账本。</p></section>',
         '["下单","订购","购买","order"]', 10),
        ('order_service', 'business_order_query', '查询订单进度', '根据订单号和联系方式查询订单处理进度。', 'TRADE_ORDER_QUERY', 'query_order_status',
         '查询订单进度', '查询进度',
         '{"title":"查询订单进度","required":["orderId"],"properties":{"orderId":{"type":"string","title":"订单号"},"contactPhone":{"type":"string","title":"联系电话"}}}',
         '<section><h3>查询订单进度</h3><p>输入订单号后查询当前处理节点。</p></section>',
         '["订单进度","查订单","查询订单","进度","order status"]', 20),
        ('after_sales', 'business_return_request', '退货申请', '收集订单号、退货原因和取件信息，登记退货申请。', 'TRADE_RETURN_APPLY', 'return_request',
         '退货申请', '提交退货申请',
         '{"title":"退货申请","required":["orderId","reason","pickupAddress"],"properties":{"orderId":{"type":"string","title":"订单号"},"reason":{"type":"string","title":"退货原因","ui:widget":"textarea"},"pickupAddress":{"type":"string","title":"取件地址","ui:widget":"textarea"},"contactPhone":{"type":"string","title":"联系电话"}}}',
         '<section><h3>退货申请</h3><p>提交后会进入售后处理账本。</p></section>',
         '["退货","退款","售后","return"]', 10),
        ('service_support', 'business_address_query', '查询服务地址', '根据城市和区域查询可服务地址。', 'TRADE_SERVICE_ADDRESS_QUERY', 'query_service_address',
         '查询服务地址', '查询地址',
         '{"title":"查询服务地址","required":["city"],"properties":{"city":{"type":"string","title":"城市"},"district":{"type":"string","title":"区域"},"serviceType":{"type":"string","title":"服务类型"}}}',
         '<section><h3>查询服务地址</h3><p>根据城市或区域查询可办理服务点。</p></section>',
         '["服务地址","网点","地址","service address"]', 10)
) AS seed(group_code, capability_code, capability_name, description, transaction_service_code, action_code, form_title, submit_label, input_schema_json, display_html, keywords_json, sort_order)
ON g.group_code = seed.group_code
ON CONFLICT (capability_code) DO UPDATE SET
    group_id = EXCLUDED.group_id,
    capability_name = EXCLUDED.capability_name,
    description = EXCLUDED.description,
    transaction_service_code = EXCLUDED.transaction_service_code,
    action_code = EXCLUDED.action_code,
    form_title = EXCLUDED.form_title,
    submit_label = EXCLUDED.submit_label,
    input_schema_json = EXCLUDED.input_schema_json,
    display_html = EXCLUDED.display_html,
    keywords_json = EXCLUDED.keywords_json,
    sort_order = EXCLUDED.sort_order,
    enabled = 1,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO customer_role_department_visibility(role_id, department_id, visibility_type)
SELECT r.id, d.id, 'visible'
FROM customer_role r
JOIN ds_department d ON d.code = 'customer_service'
WHERE r.code = 'external_customer'
ON CONFLICT (role_id, department_id) DO UPDATE SET
    visibility_type = EXCLUDED.visibility_type,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO customer_role_employee_visibility(role_id, ai_employee_id, visibility_type, can_consult, can_assign)
SELECT r.id, e.id, 'visible', 1, 0
FROM customer_role r
JOIN ds_ai_employee e ON e.department_id = (SELECT id FROM ds_department WHERE code = 'customer_service')
WHERE r.code = 'external_customer'
ON CONFLICT (role_id, ai_employee_id) DO UPDATE SET
    visibility_type = EXCLUDED.visibility_type,
    can_consult = EXCLUDED.can_consult,
    can_assign = EXCLUDED.can_assign,
    updated_at = CURRENT_TIMESTAMP;

DELETE FROM customer_department_visibility v
USING customer_member c, ds_department d
WHERE v.customer_id = c.id
  AND v.department_id = d.id
  AND c.code = 'demo_customer'
  AND d.code IN ('marketing', 'technology_rd_center');

DELETE FROM customer_employee_visibility v
USING customer_member c, ds_ai_employee e
WHERE v.customer_id = c.id
  AND v.ai_employee_id = e.id
  AND c.code = 'demo_customer'
  AND e.code IN ('marketing-pm-01', 'marketing-pm-02');

UPDATE ds_ai_employee
SET model_config_json = '{"modelProfileCode":"worker_chat_llm"}',
    updated_at = CURRENT_TIMESTAMP
WHERE model_config_json IS NULL
   OR model_config_json LIKE '%default_generalist%'
   OR model_config_json LIKE '%strategy_research_model%'
   OR model_config_json LIKE '%technology_architect_model%';

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
VALUES (NULL, 'quick_capability.view', '系统快捷能力', 'page', 'quick_capabilities', 'zap', 69, 1)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    route_key = EXCLUDED.route_key,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT page.id, 'quick_capability.manage', '管理系统快捷能力', 'action', NULL, NULL, 10, 1
FROM sys_menu page
WHERE page.code = 'quick_capability.view'
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_role_permission(role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
CROSS JOIN sys_menu m
WHERE r.admin_role = 1
  AND m.code IN ('quick_capability.view', 'quick_capability.manage')
ON CONFLICT (role_id, menu_id) DO NOTHING;
