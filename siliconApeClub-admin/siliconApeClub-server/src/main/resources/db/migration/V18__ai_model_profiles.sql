CREATE TABLE IF NOT EXISTS sys_ai_model_profile (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    profile_code VARCHAR(80) UNIQUE NOT NULL,
    profile_name VARCHAR(120) NOT NULL,
    provider VARCHAR(40) NOT NULL,
    purpose VARCHAR(40) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    api_key CLOB,
    model_name VARCHAR(120) NOT NULL,
    dimensions INTEGER,
    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    enabled SMALLINT NOT NULL DEFAULT 1,
    default_profile SMALLINT NOT NULL DEFAULT 0,
    fallback_enabled SMALLINT NOT NULL DEFAULT 1,
    config_json CLOB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sys_ai_model_profile_purpose ON sys_ai_model_profile(purpose, enabled, default_profile);

MERGE INTO sys_ai_model_profile KEY(profile_code) VALUES
    (1, 'document_wiki_llm', '文档生成 LLM Wiki', 'openai_compatible', 'document_to_wiki',
     'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', NULL, 'qwen-plus', NULL,
     60, 1, 1, 1, '{"temperature":0.2,"maxTokens":2400}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (2, 'worker_chat_llm', 'AI 员工分析对话', 'openai_compatible', 'worker_chat',
     'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', NULL, 'qwen-plus', NULL,
     40, 1, 1, 1, '{"temperature":0.4,"maxTokens":1200}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (3, 'rag_embedding', 'RAG Embedding', 'openai_compatible', 'rag_embedding',
     'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings', NULL, 'text-embedding-v4', 1024,
     30, 1, 1, 1, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (4, 'rag_rerank', 'RAG Rerank', 'dashscope_rerank', 'rag_rerank',
     'https://dashscope.aliyuncs.com/compatible-api/v1/reranks', NULL, 'qwen3-rerank', NULL,
     30, 1, 1, 1, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
KEY(code)
SELECT id, 'settings.ai_model.view', 'AI 模型配置', 'page', 'settings_ai_model', 'settings', 50, 1
FROM sys_menu
WHERE code = 'settings.view';

MERGE INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
KEY(code)
SELECT id, 'settings.ai_model.edit', '编辑 AI 模型配置', 'action', NULL, NULL, 10, 1
FROM sys_menu
WHERE code = 'settings.ai_model.view';

MERGE INTO sys_menu(parent_id, code, name, type, route_key, icon, sort_order, enabled)
KEY(code)
SELECT id, 'settings.ai_model.test', '测试 AI 模型配置', 'action', NULL, NULL, 20, 1
FROM sys_menu
WHERE code = 'settings.ai_model.view';

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, id
FROM sys_menu
WHERE code = 'settings.ai_model.view'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission
      WHERE role_id = 1 AND menu_id = sys_menu.id
  );

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, id
FROM sys_menu
WHERE code = 'settings.ai_model.edit'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission
      WHERE role_id = 1 AND menu_id = sys_menu.id
  );

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, id
FROM sys_menu
WHERE code = 'settings.ai_model.test'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission
      WHERE role_id = 1 AND menu_id = sys_menu.id
  );
