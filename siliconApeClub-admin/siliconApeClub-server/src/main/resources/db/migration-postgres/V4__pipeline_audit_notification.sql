CREATE TABLE ks_pipeline_job (
    id BIGSERIAL PRIMARY KEY,
    job_type VARCHAR(64) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_id BIGINT NOT NULL,
    source_version INT,
    target_type VARCHAR(32),
    target_id BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    attempt_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    result_json TEXT,
    created_by BIGINT,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_audit_trace (
    id BIGSERIAL PRIMARY KEY,
    trace_id VARCHAR(64),
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(64),
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64),
    target_id VARCHAR(64),
    request_path VARCHAR(255),
    result_status VARCHAR(32) NOT NULL DEFAULT 'success',
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ks_notification (
    id BIGSERIAL PRIMARY KEY,
    recipient_type VARCHAR(32) NOT NULL DEFAULT 'USER',
    recipient_id VARCHAR(64),
    channel VARCHAR(32) NOT NULL DEFAULT 'in_app',
    severity VARCHAR(32) NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    content TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'unread',
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

CREATE INDEX idx_pipeline_job_source ON ks_pipeline_job(source_type, source_id, source_version);
CREATE INDEX idx_pipeline_job_status ON ks_pipeline_job(status, created_at DESC);
CREATE INDEX idx_audit_trace_action ON ks_audit_trace(action, created_at DESC);
CREATE INDEX idx_audit_trace_target ON ks_audit_trace(target_type, target_id);
CREATE INDEX idx_notification_recipient ON ks_notification(recipient_type, recipient_id, status, created_at DESC);
