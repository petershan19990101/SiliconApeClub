UPDATE sys_menu
SET name = '知识资产'
WHERE route_key = 'library' OR code = 'library.view';

UPDATE sys_menu
SET name = '全域检索'
WHERE route_key = 'search' OR code = 'search.view';

UPDATE sys_menu
SET name = 'AI 员工配置'
WHERE route_key = 'ai_employees' OR code = 'ai_employee.view';

UPDATE sys_menu
SET name = '知识运营健康'
WHERE route_key = 'knowledge_health' OR code = 'knowledge_health.view';
