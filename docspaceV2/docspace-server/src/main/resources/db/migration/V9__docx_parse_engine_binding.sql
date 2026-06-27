INSERT INTO ds_parse_engine_binding(file_extension, engine_code, engine_name, is_default, enabled, sort_order)
VALUES ('docx', 'apache_poi_docx_java_engine', 'Apache_POI_docx_引擎', 1, 1, 20)
ON DUPLICATE KEY UPDATE
    engine_name = VALUES(engine_name),
    is_default = VALUES(is_default),
    enabled = VALUES(enabled),
    sort_order = VALUES(sort_order);
