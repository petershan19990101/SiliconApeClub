CREATE TABLE ks_runtime_session (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL UNIQUE,
    ai_employee_id BIGINT NOT NULL,
    position_package_id BIGINT,
    position_package_version INT NOT NULL DEFAULT 1,
    department_id BIGINT,
    project_id VARCHAR(64),
    task_type VARCHAR(64),
    security_context TEXT,
    acl_version INT NOT NULL DEFAULT 1,
    runtime_profile_hash VARCHAR(128),
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_task_memory (
    id BIGSERIAL PRIMARY KEY,
    task_memory_id VARCHAR(64) NOT NULL UNIQUE,
    ai_employee_id BIGINT NOT NULL,
    runtime_session_id VARCHAR(64),
    task_id VARCHAR(128),
    task_goal TEXT,
    input_summary TEXT,
    query_log TEXT,
    retrieved_chunk_ids TEXT,
    cited_chunk_ids TEXT,
    output_summary TEXT,
    human_feedback TEXT,
    success_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
    promote_status VARCHAR(32) NOT NULL DEFAULT 'none',
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_wiki_proposal (
    id BIGSERIAL PRIMARY KEY,
    proposal_id VARCHAR(64) NOT NULL UNIQUE,
    source_task_memory_id VARCHAR(64),
    created_by_actor_type VARCHAR(32) NOT NULL,
    created_by_actor_id VARCHAR(64) NOT NULL,
    suggested_template VARCHAR(64),
    title VARCHAR(255) NOT NULL,
    draft_content TEXT NOT NULL,
    evidence_json TEXT,
    citation_ids TEXT,
    applicable_positions TEXT,
    risk_level VARCHAR(32) NOT NULL DEFAULT 'medium',
    review_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    reviewer_id BIGINT,
    review_comment TEXT,
    published_page_id BIGINT,
    published_page_version INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_wiki_proposal_evidence (
    id BIGSERIAL PRIMARY KEY,
    proposal_id VARCHAR(64) NOT NULL,
    evidence_type VARCHAR(64) NOT NULL,
    evidence_ref VARCHAR(255),
    evidence_summary TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_feedback (
    id BIGSERIAL PRIMARY KEY,
    feedback_id VARCHAR(64) NOT NULL UNIQUE,
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    feedback_type VARCHAR(64) NOT NULL,
    target_type VARCHAR(64),
    target_id VARCHAR(64),
    severity VARCHAR(32) NOT NULL DEFAULT 'medium',
    content TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ks_citation_log ADD COLUMN IF NOT EXISTS task_memory_id VARCHAR(64);
ALTER TABLE ks_citation_log ADD COLUMN IF NOT EXISTS runtime_session_id VARCHAR(64);

CREATE INDEX idx_runtime_ai_employee ON ks_runtime_session(ai_employee_id, created_at DESC);
CREATE INDEX idx_task_memory_ai_employee ON ks_task_memory(ai_employee_id, created_at DESC);
CREATE INDEX idx_task_memory_promote_status ON ks_task_memory(promote_status);
CREATE INDEX idx_wiki_proposal_status ON ks_wiki_proposal(review_status, created_at DESC);
CREATE INDEX idx_feedback_status ON ks_feedback(status, created_at DESC);
