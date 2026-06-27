CREATE TABLE ks_ai_employee_package (
    id BIGSERIAL PRIMARY KEY,
    ai_employee_id BIGINT NOT NULL,
    package_id BIGINT NOT NULL,
    enabled SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_ai_employee_package UNIQUE (ai_employee_id, package_id)
);

INSERT INTO ks_ai_employee_package(ai_employee_id, package_id)
SELECT 1, 1
WHERE EXISTS (SELECT 1 FROM ds_ai_employee WHERE id = 1)
  AND EXISTS (SELECT 1 FROM ks_position_package WHERE id = 1)
ON CONFLICT DO NOTHING;

INSERT INTO ks_ai_employee_package(ai_employee_id, package_id)
SELECT 2, 2
WHERE EXISTS (SELECT 1 FROM ds_ai_employee WHERE id = 2)
  AND EXISTS (SELECT 1 FROM ks_position_package WHERE id = 2)
ON CONFLICT DO NOTHING;
