CREATE TABLE IF NOT EXISTS sys_ai_model_profile (
    id BIGSERIAL PRIMARY KEY,
    profile_code VARCHAR(80) UNIQUE NOT NULL,
    profile_name VARCHAR(120) NOT NULL,
    provider VARCHAR(40) NOT NULL,
    purpose VARCHAR(40) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    api_key TEXT,
    model_name VARCHAR(120) NOT NULL,
    dimensions INTEGER,
    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    enabled SMALLINT NOT NULL DEFAULT 1,
    default_profile SMALLINT NOT NULL DEFAULT 0,
    fallback_enabled SMALLINT NOT NULL DEFAULT 1,
    config_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sys_ai_model_profile_purpose ON sys_ai_model_profile(purpose, enabled, default_profile);

INSERT INTO sys_ai_model_profile(
    profile_code, profile_name, provider, purpose, endpoint, api_key, model_name, dimensions,
    timeout_seconds, enabled, default_profile, fallback_enabled, config_json
)
VALUES
    ('document_wiki_llm', '文档生成 LLM Wiki', 'openai_compatible', 'document_to_wiki',
     'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', NULL, 'qwen-plus', NULL,
     60, 1, 1, 1, '{"temperature":0.2,"maxTokens":2400}'),
    ('worker_chat_llm', 'AI 员工分析对话', 'openai_compatible', 'worker_chat',
     'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', NULL, 'qwen-plus', NULL,
     40, 1, 1, 1, '{"temperature":0.4,"maxTokens":1200}'),
    ('rag_embedding', 'RAG Embedding', 'openai_compatible', 'rag_embedding',
     'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings', NULL, 'text-embedding-v4', 1024,
     30, 1, 1, 1, '{}'),
    ('rag_rerank', 'RAG Rerank', 'dashscope_rerank', 'rag_rerank',
     'https://dashscope.aliyuncs.com/compatible-api/v1/reranks', NULL, 'qwen3-rerank', NULL,
     30, 1, 1, 1, '{}')
ON CONFLICT (profile_code) DO UPDATE SET
    profile_name = EXCLUDED.profile_name,
    provider = EXCLUDED.provider,
    purpose = EXCLUDED.purpose,
    endpoint = EXCLUDED.endpoint,
    model_name = EXCLUDED.model_name,
    dimensions = EXCLUDED.dimensions,
    timeout_seconds = EXCLUDED.timeout_seconds,
    enabled = EXCLUDED.enabled,
    default_profile = EXCLUDED.default_profile,
    fallback_enabled = EXCLUDED.fallback_enabled,
    config_json = EXCLUDED.config_json,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_menu (parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT id, 'settings.ai_model.view', 'AI 模型配置', 'page', 'settings_ai_model', 'settings', 50, 1
FROM sys_menu
WHERE code = 'settings.view'
ON CONFLICT (code) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    route_key = EXCLUDED.route_key,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_menu (parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT id, 'settings.ai_model.edit', '编辑 AI 模型配置', 'action', NULL, NULL, 10, 1
FROM sys_menu
WHERE code = 'settings.ai_model.view'
ON CONFLICT (code) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    route_key = EXCLUDED.route_key,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_menu (parent_id, code, name, type, route_key, icon, sort_order, enabled)
SELECT id, 'settings.ai_model.test', '测试 AI 模型配置', 'action', NULL, NULL, 20, 1
FROM sys_menu
WHERE code = 'settings.ai_model.view'
ON CONFLICT (code) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    route_key = EXCLUDED.route_key,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sys_role_permission (role_id, menu_id)
SELECT 1, id FROM sys_menu WHERE code IN (
    'settings.ai_model.view',
    'settings.ai_model.edit',
    'settings.ai_model.test'
)
ON CONFLICT DO NOTHING;
