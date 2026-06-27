package com.docspace.server.modules.ai.service;

import com.docspace.server.modules.ai.dto.AiEmployeePackagesRequest;
import com.docspace.server.modules.ai.dto.AiEmployeeRequest;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AiEmployeeService {

    private final JdbcTemplate jdbcTemplate;
    private final KnowledgeService knowledgeService;

    public List<Map<String, Object>> list() {
        return jdbcTemplate.query(
                "SELECT id, code, name, description, position_code, department_id, enabled, status, created_at, updated_at " +
                        "FROM ds_ai_employee ORDER BY updated_at DESC",
                knowledgeService.rowMapper());
    }

    public Map<String, Object> get(Long id) {
        Map<String, Object> item = jdbcTemplate.queryForObject(
                "SELECT id, code, name, description, position_code, department_id, enabled, status, created_at, updated_at " +
                        "FROM ds_ai_employee WHERE id = ?",
                knowledgeService.rowMapper(), id);
        item.put("packages", packages(id));
        return item;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> create(AiEmployeeRequest request) {
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO ds_ai_employee(code, name, description, position_code, department_id, enabled, status) " +
                        "VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE') RETURNING id",
                Long.class,
                request.getCode(),
                request.getName(),
                request.getDescription(),
                request.getPositionCode(),
                request.getDepartmentId(),
                Boolean.FALSE.equals(request.getEnabled()) ? 0 : 1);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> update(Long id, AiEmployeeRequest request) {
        jdbcTemplate.update(
                "UPDATE ds_ai_employee SET code = ?, name = ?, description = ?, position_code = ?, department_id = ?, enabled = ?, updated_at = ? WHERE id = ?",
                request.getCode(),
                request.getName(),
                request.getDescription(),
                request.getPositionCode(),
                request.getDepartmentId(),
                Boolean.FALSE.equals(request.getEnabled()) ? 0 : 1,
                LocalDateTime.now(),
                id);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updatePackages(Long id, AiEmployeePackagesRequest request) {
        jdbcTemplate.update("DELETE FROM ks_ai_employee_package WHERE ai_employee_id = ?", id);
        if (request.getPackageIds() != null) {
            for (Long packageId : request.getPackageIds()) {
                jdbcTemplate.update("INSERT INTO ks_ai_employee_package(ai_employee_id, package_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                        id, packageId);
            }
        }
        return get(id);
    }

    public List<Map<String, Object>> packages(Long id) {
        return jdbcTemplate.query(
                "SELECT p.id, p.code, p.name, p.position_code, p.status " +
                        "FROM ks_ai_employee_package b JOIN ks_position_package p ON p.id = b.package_id " +
                        "WHERE b.ai_employee_id = ? AND b.enabled = 1 ORDER BY p.name",
                knowledgeService.rowMapper(), id);
    }
}
