DELETE FROM ds_parse_engine_binding
WHERE file_extension = 'pptx'
  AND engine_code = 'apache_poi_pptx_java_engine';
