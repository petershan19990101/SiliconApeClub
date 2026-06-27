UPDATE sys_menu
SET name = 'Wiki 中心', updated_at = CURRENT_TIMESTAMP
WHERE route_key = 'wiki';

UPDATE sys_menu
SET name = '岗位知识管理', code = 'position_knowledge.view', updated_at = CURRENT_TIMESTAMP
WHERE route_key = 'position_packages';

UPDATE sys_menu
SET name = 'RAG 管理台', code = 'rag_management.view', updated_at = CURRENT_TIMESTAMP
WHERE route_key = 'rag_debug';

UPDATE sys_menu
SET name = '编辑岗位知识管理', code = 'position_knowledge.edit', updated_at = CURRENT_TIMESTAMP
WHERE code = 'position_package.edit';
