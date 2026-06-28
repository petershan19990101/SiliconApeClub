UPDATE sys_menu
SET name = '生成 Wiki/RAG', updated_at = CURRENT_TIMESTAMP
WHERE code = 'document.push_rag';
