CREATE TABLE IF NOT EXISTS ds_parse_engine_binding (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '解析引擎绑定主键',
    file_extension VARCHAR(32) NOT NULL COMMENT '文件扩展名(小写, 不含点)',
    engine_code VARCHAR(128) NOT NULL COMMENT '解析引擎编码',
    engine_name VARCHAR(128) NOT NULL COMMENT '解析引擎展示名称',
    is_default TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认引擎, 1是0否',
    enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用, 1启用0停用',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值, 越小越靠前',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT='解析引擎与文件类型绑定配置';

CREATE TABLE IF NOT EXISTS ds_document_parse_artifact (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '解析产物主键',
    document_id BIGINT NOT NULL COMMENT '文档ID',
    version INT NOT NULL COMMENT '文档版本号',
    artifact_type VARCHAR(32) NOT NULL COMMENT '产物类型: text/image/markdown',
    artifact_name VARCHAR(255) NOT NULL COMMENT '产物文件名',
    mime_type VARCHAR(128) NOT NULL COMMENT '产物MIME类型',
    page_no INT NULL COMMENT '页码(文本/图片适用)',
    sequence_no INT NULL COMMENT '同页内序号',
    storage_bucket VARCHAR(128) NOT NULL COMMENT '对象存储桶',
    storage_object VARCHAR(255) NOT NULL COMMENT '对象存储键',
    size_bytes BIGINT NOT NULL DEFAULT 0 COMMENT '产物大小(字节)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) COMMENT='文档解析中间产物与最终产物';

CREATE UNIQUE INDEX idx_parse_engine_binding_unique
    ON ds_parse_engine_binding(file_extension, engine_code);
CREATE INDEX idx_parse_engine_binding_lookup
    ON ds_parse_engine_binding(file_extension, enabled, is_default, sort_order);
CREATE INDEX idx_parse_artifact_doc_version
    ON ds_document_parse_artifact(document_id, version, artifact_type, page_no, sequence_no);

INSERT INTO ds_parse_engine_binding(file_extension, engine_code, engine_name, is_default, enabled, sort_order)
VALUES ('pdf', 'apache_pdfbox_java_engine', 'Apache_PDFBox_java_引擎', 1, 1, 10)
ON DUPLICATE KEY UPDATE
    engine_name = VALUES(engine_name),
    is_default = VALUES(is_default),
    enabled = VALUES(enabled),
    sort_order = VALUES(sort_order);
