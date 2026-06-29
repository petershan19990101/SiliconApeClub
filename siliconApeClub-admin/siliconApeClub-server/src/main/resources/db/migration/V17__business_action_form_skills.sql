INSERT INTO hr_skill_repository(
    code, name, description, department_id, skill_type, skill_level, invocation_mode,
    input_schema_json, output_schema_json, orchestration_config_json, guardrails_json,
    source_type, review_status, enabled, created_by
)
VALUES
    (
        'business_order_create',
        '业务下单',
        '收集商品、数量、联系人和收货地址，直接创建演示订单。',
        (SELECT id FROM ds_department WHERE code = 'customer_service'),
        'business_action',
        'basic',
        'form_submit',
        '{"title":"业务下单","required":["productName","quantity","deliveryAddress","contactPhone"],"properties":{"productName":{"type":"string","title":"商品/服务名称","placeholder":"例如：企业知识库初始化服务"},"quantity":{"type":"number","title":"数量","default":1},"deliveryAddress":{"type":"string","title":"收货/服务地址","ui:widget":"textarea"},"contactPhone":{"type":"string","title":"联系电话"},"remark":{"type":"string","title":"备注","ui:widget":"textarea"}}}',
        '{"type":"object","properties":{"orderId":{"type":"string"},"status":{"type":"string"}}}',
        '{"actionCode":"create_order","formTitle":"业务下单","submitLabel":"提交订单","defaultVisible":true,"deterministic":true,"keywords":["下单","订购","购买","order"],"routeEmployeeCodes":["frontdesk-ada","customer-service-01"],"displayHtml":"<section><h3>业务下单</h3><p>请填写精确入参，提交后直接创建订单账本。</p></section>"}',
        '{"externalVisible":true,"humanReviewRequired":false}',
        'human',
        'approved',
        1,
        'system'
    ),
    (
        'business_order_query',
        '查询订单进度',
        '通过订单号和联系方式查询当前订单处理进度。',
        (SELECT id FROM ds_department WHERE code = 'customer_service'),
        'business_action',
        'basic',
        'form_submit',
        '{"title":"查询订单进度","required":["orderId"],"properties":{"orderId":{"type":"string","title":"订单号"},"contactPhone":{"type":"string","title":"联系电话"}}}',
        '{"type":"object","properties":{"orderId":{"type":"string"},"status":{"type":"string"}}}',
        '{"actionCode":"query_order_status","formTitle":"查询订单进度","submitLabel":"查询进度","defaultVisible":true,"deterministic":true,"keywords":["订单进度","查订单","查询订单","进度","order status"],"routeEmployeeCodes":["frontdesk-ada","customer-service-01"],"displayHtml":"<section><h3>查询订单进度</h3><p>输入订单号即可查询，不需要再次走大模型。</p></section>"}',
        '{"externalVisible":true,"humanReviewRequired":false}',
        'human',
        'approved',
        1,
        'system'
    ),
    (
        'business_return_request',
        '退货申请',
        '收集订单号、退货原因和取件信息，登记退货申请。',
        (SELECT id FROM ds_department WHERE code = 'customer_service'),
        'business_action',
        'basic',
        'form_submit',
        '{"title":"退货申请","required":["orderId","reason","pickupAddress"],"properties":{"orderId":{"type":"string","title":"订单号"},"reason":{"type":"string","title":"退货原因","ui:widget":"textarea"},"pickupAddress":{"type":"string","title":"取件地址","ui:widget":"textarea"},"contactPhone":{"type":"string","title":"联系电话"}}}',
        '{"type":"object","properties":{"returnRequestId":{"type":"string"},"status":{"type":"string"}}}',
        '{"actionCode":"return_request","formTitle":"退货申请","submitLabel":"提交退货申请","defaultVisible":true,"deterministic":true,"keywords":["退货","退款","售后","return"],"routeEmployeeCodes":["frontdesk-ada","customer-service-01"],"displayHtml":"<section><h3>退货申请</h3><p>请提供订单号、原因和取件地址，客服 AI 员工会跟进审核。</p></section>"}',
        '{"externalVisible":true,"humanReviewRequired":false}',
        'human',
        'approved',
        1,
        'system'
    ),
    (
        'business_address_query',
        '查询服务地址',
        '根据城市或区域查询可服务地址。',
        (SELECT id FROM ds_department WHERE code = 'customer_service'),
        'business_action',
        'basic',
        'form_submit',
        '{"title":"查询服务地址","required":["region"],"properties":{"region":{"type":"string","title":"城市/区域"},"serviceType":{"type":"string","title":"服务类型","enum":["售前咨询","订单履约","售后服务"]}}}',
        '{"type":"object","properties":{"addresses":{"type":"array"}}}',
        '{"actionCode":"query_service_address","formTitle":"查询服务地址","submitLabel":"查询地址","defaultVisible":true,"deterministic":true,"keywords":["地址","网点","服务地址","查询地址","address"],"routeEmployeeCodes":["frontdesk-ada","customer-service-01"],"displayHtml":"<section><h3>查询服务地址</h3><p>填写区域后直接查询可服务地址。</p></section>"}',
        '{"externalVisible":true,"humanReviewRequired":false}',
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

INSERT INTO hr_skill_binding(ai_employee_id, skill_id, sort_order)
SELECT e.id, s.id, binding.sort_order
FROM (
    VALUES
        ('frontdesk-ada', 'business_order_create', 30),
        ('frontdesk-ada', 'business_order_query', 40),
        ('frontdesk-ada', 'business_return_request', 50),
        ('frontdesk-ada', 'business_address_query', 60),
        ('customer-service-01', 'business_order_create', 30),
        ('customer-service-01', 'business_order_query', 40),
        ('customer-service-01', 'business_return_request', 50),
        ('customer-service-01', 'business_address_query', 60)
) AS binding(employee_code, skill_code, sort_order)
JOIN ds_ai_employee e ON e.code = binding.employee_code
JOIN hr_skill_repository s ON s.code = binding.skill_code
ON CONFLICT (ai_employee_id, skill_id) DO UPDATE SET
    enabled = 1,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;
