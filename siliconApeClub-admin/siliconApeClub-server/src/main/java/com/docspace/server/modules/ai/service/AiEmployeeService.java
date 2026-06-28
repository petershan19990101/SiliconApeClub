package com.docspace.server.modules.ai.service;

import com.docspace.server.modules.ai.dto.AiEmployeePackagesRequest;
import com.docspace.server.modules.ai.dto.AiEmployeeRequest;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import java.math.BigDecimal;
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
                "SELECT e.id, e.code, e.name, e.description, e.position_code, e.department_id, d.name AS department_name, " +
                        "e.role_title, e.responsibilities, e.skills_json, e.contact_relations_json, e.memory_policy_json, " +
                        "e.model_config_json, e.hr_role_code, e.manager_employee_id, manager.name AS manager_name, " +
                        "e.employment_type, e.cost_rate, e.performance_status, e.enabled, e.status, e.created_at, e.updated_at " +
                        "FROM ds_ai_employee e " +
                        "LEFT JOIN ds_department d ON d.id = e.department_id " +
                        "LEFT JOIN ds_ai_employee manager ON manager.id = e.manager_employee_id " +
                        "ORDER BY COALESCE(d.sort_order, 999), e.updated_at DESC",
                knowledgeService.rowMapper());
    }

    public Map<String, Object> get(Long id) {
        Map<String, Object> item = jdbcTemplate.queryForObject(
                "SELECT e.id, e.code, e.name, e.description, e.position_code, e.department_id, d.name AS department_name, " +
                        "e.role_title, e.responsibilities, e.skills_json, e.contact_relations_json, e.memory_policy_json, " +
                        "e.model_config_json, e.hr_role_code, e.manager_employee_id, manager.name AS manager_name, " +
                        "e.employment_type, e.cost_rate, e.performance_status, e.enabled, e.status, e.created_at, e.updated_at " +
                        "FROM ds_ai_employee e " +
                        "LEFT JOIN ds_department d ON d.id = e.department_id " +
                        "LEFT JOIN ds_ai_employee manager ON manager.id = e.manager_employee_id " +
                        "WHERE e.id = ?",
                knowledgeService.rowMapper(), id);
        item.put("packages", packages(id));
        item.put("contacts", contacts(id));
        return item;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> create(AiEmployeeRequest request) {
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO ds_ai_employee(code, name, description, position_code, department_id, role_title, responsibilities, " +
                        "skills_json, contact_relations_json, memory_policy_json, model_config_json, hr_role_code, manager_employee_id, " +
                        "employment_type, cost_rate, performance_status, enabled, status) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE') RETURNING id",
                Long.class,
                request.getCode(),
                request.getName(),
                request.getDescription(),
                request.getPositionCode(),
                request.getDepartmentId(),
                request.getRoleTitle(),
                request.getResponsibilities(),
                request.getSkillsJson(),
                request.getContactRelationsJson(),
                request.getMemoryPolicyJson(),
                request.getModelConfigJson(),
                request.getHrRoleCode(),
                request.getManagerEmployeeId(),
                defaultString(request.getEmploymentType(), "ai_employee"),
                defaultDecimal(request.getCostRate()),
                defaultString(request.getPerformanceStatus(), "trial"),
                Boolean.FALSE.equals(request.getEnabled()) ? 0 : 1);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> update(Long id, AiEmployeeRequest request) {
        jdbcTemplate.update(
                "UPDATE ds_ai_employee SET code = ?, name = ?, description = ?, position_code = ?, department_id = ?, " +
                        "role_title = ?, responsibilities = ?, skills_json = ?, contact_relations_json = ?, memory_policy_json = ?, " +
                        "model_config_json = ?, hr_role_code = ?, manager_employee_id = ?, employment_type = ?, cost_rate = ?, " +
                        "performance_status = ?, enabled = ?, updated_at = ? WHERE id = ?",
                request.getCode(),
                request.getName(),
                request.getDescription(),
                request.getPositionCode(),
                request.getDepartmentId(),
                request.getRoleTitle(),
                request.getResponsibilities(),
                request.getSkillsJson(),
                request.getContactRelationsJson(),
                request.getMemoryPolicyJson(),
                request.getModelConfigJson(),
                request.getHrRoleCode(),
                request.getManagerEmployeeId(),
                defaultString(request.getEmploymentType(), "ai_employee"),
                defaultDecimal(request.getCostRate()),
                defaultString(request.getPerformanceStatus(), "trial"),
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

    public List<Map<String, Object>> contacts(Long id) {
        return jdbcTemplate.query(
                "SELECT r.id, r.ai_employee_id, r.related_employee_id, e.name AS related_employee_name, " +
                        "e.role_title AS related_role_title, r.relation_type, r.description, r.created_at " +
                        "FROM hr_employee_contact_relation r " +
                        "JOIN ds_ai_employee e ON e.id = r.related_employee_id " +
                        "WHERE r.ai_employee_id = ? ORDER BY r.relation_type, e.name",
                knowledgeService.rowMapper(), id);
    }

    private String defaultString(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private BigDecimal defaultDecimal(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
