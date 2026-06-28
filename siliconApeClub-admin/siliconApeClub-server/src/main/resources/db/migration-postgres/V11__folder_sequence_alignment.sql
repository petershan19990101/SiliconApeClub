SELECT setval(
    pg_get_serial_sequence('ds_folder', 'id'),
    COALESCE((SELECT MAX(id) FROM ds_folder), 1),
    true
);
