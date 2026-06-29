package com.docspace.server.modules.ai.service;

import com.docspace.server.modules.knowledge.service.KnowledgeService;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OrganizationHumanCenterService {

    private final JdbcTemplate jdbcTemplate;
    private final KnowledgeService knowledgeService;
    private final AiEmployeeService aiEmployeeService;
    private final SkillRepositoryService skillRepositoryService;

    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("departments", jdbcTemplate.query(
                "SELECT id, code, parent_id, name, unit_type, description, sort_order, enabled, created_at, updated_at " +
                        "FROM ds_department ORDER BY COALESCE(sort_order, 999), id",
                knowledgeService.rowMapper()));
        result.put("positions", jdbcTemplate.query(
                "SELECT p.id, p.code, p.name, p.description, p.department_id, d.name AS department_name, p.enabled, p.created_at, p.updated_at " +
                        "FROM ds_position p LEFT JOIN ds_department d ON d.id = p.department_id " +
                        "ORDER BY d.sort_order, p.name",
                knowledgeService.rowMapper()));
        result.put("roles", jdbcTemplate.query(
                "SELECT id, code, name, description, permissions_json, enabled, created_at, updated_at " +
                        "FROM hr_role ORDER BY name",
                knowledgeService.rowMapper()));
        result.put("modelProfiles", jdbcTemplate.query(
                "SELECT id, profile_code AS code, profile_name AS name, provider, model_name, purpose, config_json, enabled, created_at, updated_at " +
                        "FROM sys_ai_model_profile WHERE purpose = 'worker_chat' AND enabled = 1 " +
                        "ORDER BY default_profile DESC, profile_name",
                knowledgeService.rowMapper()));
        result.put("employees", aiEmployeeService.list());
        result.put("skills", skillRepositoryService.list(null));
        result.put("customers", jdbcTemplate.query(
                "SELECT id, code, name, customer_type, principal_code, contact_name, contact_email, status, metadata_json, created_at, updated_at " +
                        "FROM customer_member ORDER BY updated_at DESC",
                knowledgeService.rowMapper()));
        result.put("customerRoles", jdbcTemplate.query(
                "SELECT id, code, name, description, permissions_json, enabled, created_at, updated_at " +
                        "FROM customer_role ORDER BY name",
                knowledgeService.rowMapper()));
        result.put("customerDepartmentVisibility", jdbcTemplate.query(
                "SELECT v.id, v.customer_id, c.name AS customer_name, v.department_id, d.name AS department_name, " +
                        "v.visibility_type, v.created_at " +
                        "FROM customer_department_visibility v " +
                        "JOIN customer_member c ON c.id = v.customer_id " +
                        "JOIN ds_department d ON d.id = v.department_id " +
                        "ORDER BY c.name, d.sort_order",
                knowledgeService.rowMapper()));
        result.put("customerEmployeeVisibility", jdbcTemplate.query(
                "SELECT v.id, v.customer_id, c.name AS customer_name, v.ai_employee_id, e.name AS employee_name, " +
                        "e.role_title, d.name AS department_name, v.visibility_type, v.can_consult, v.can_assign, v.created_at " +
                        "FROM customer_employee_visibility v " +
                        "JOIN customer_member c ON c.id = v.customer_id " +
                        "JOIN ds_ai_employee e ON e.id = v.ai_employee_id " +
                        "LEFT JOIN ds_department d ON d.id = e.department_id " +
                        "ORDER BY c.name, d.sort_order, e.name",
                knowledgeService.rowMapper()));
        result.put("customerRoleDepartmentVisibility", jdbcTemplate.query(
                "SELECT v.id, v.role_id, r.name AS role_name, r.code AS role_code, v.department_id, d.name AS department_name, " +
                        "v.visibility_type, v.created_at " +
                        "FROM customer_role_department_visibility v " +
                        "JOIN customer_role r ON r.id = v.role_id " +
                        "JOIN ds_department d ON d.id = v.department_id " +
                        "ORDER BY r.name, d.sort_order",
                knowledgeService.rowMapper()));
        result.put("customerRoleEmployeeVisibility", jdbcTemplate.query(
                "SELECT v.id, v.role_id, r.name AS role_name, r.code AS role_code, v.ai_employee_id, e.name AS employee_name, " +
                        "e.role_title, d.name AS department_name, v.visibility_type, v.can_consult, v.can_assign, v.created_at " +
                        "FROM customer_role_employee_visibility v " +
                        "JOIN customer_role r ON r.id = v.role_id " +
                        "JOIN ds_ai_employee e ON e.id = v.ai_employee_id " +
                        "LEFT JOIN ds_department d ON d.id = e.department_id " +
                        "ORDER BY r.name, d.sort_order, e.name",
                knowledgeService.rowMapper()));
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> replaceCustomerVisibility(Long customerId, Map<String, Object> request) {
        jdbcTemplate.update("DELETE FROM customer_department_visibility WHERE customer_id = ?", customerId);
        jdbcTemplate.update("DELETE FROM customer_employee_visibility WHERE customer_id = ?", customerId);

        Object departmentIds = request.get("departmentIds");
        if (departmentIds instanceof List) {
            for (Object departmentId : (List<?>) departmentIds) {
                Long value = asLong(departmentId);
                if (value != null) {
                    jdbcTemplate.update(
                            "INSERT INTO customer_department_visibility(customer_id, department_id, visibility_type) VALUES (?, ?, 'visible') " +
                                    "ON CONFLICT (customer_id, department_id) DO NOTHING",
                            customerId, value);
                }
            }
        }

        Object employees = request.get("employees");
        if (employees instanceof List) {
            for (Object employeeItem : (List<?>) employees) {
                if (!(employeeItem instanceof Map)) {
                    continue;
                }
                Map<?, ?> employee = (Map<?, ?>) employeeItem;
                Long employeeId = asLong(employee.get("aiEmployeeId"));
                if (employeeId == null) {
                    continue;
                }
                jdbcTemplate.update(
                        "INSERT INTO customer_employee_visibility(customer_id, ai_employee_id, visibility_type, can_consult, can_assign) " +
                                "VALUES (?, ?, 'visible', ?, ?) " +
                                "ON CONFLICT (customer_id, ai_employee_id) DO UPDATE SET " +
                                "can_consult = EXCLUDED.can_consult, can_assign = EXCLUDED.can_assign",
                        customerId,
                        employeeId,
                        asBoolean(employee.get("canConsult")) ? 1 : 0,
                        asBoolean(employee.get("canAssign")) ? 1 : 0);
            }
        }
        return overview();
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> replaceCustomerRoleVisibility(Long roleId, Map<String, Object> request) {
        jdbcTemplate.update("DELETE FROM customer_role_department_visibility WHERE role_id = ?", roleId);
        jdbcTemplate.update("DELETE FROM customer_role_employee_visibility WHERE role_id = ?", roleId);

        Object departmentIds = request.get("departmentIds");
        if (departmentIds instanceof List) {
            for (Object departmentId : (List<?>) departmentIds) {
                Long value = asLong(departmentId);
                if (value != null) {
                    jdbcTemplate.update(
                            "INSERT INTO customer_role_department_visibility(role_id, department_id, visibility_type) VALUES (?, ?, 'visible') " +
                                    "ON CONFLICT (role_id, department_id) DO NOTHING",
                            roleId, value);
                }
            }
        }

        Object employees = request.get("employees");
        if (employees instanceof List) {
            for (Object employeeItem : (List<?>) employees) {
                if (!(employeeItem instanceof Map)) {
                    continue;
                }
                Map<?, ?> employee = (Map<?, ?>) employeeItem;
                Long employeeId = asLong(employee.get("aiEmployeeId"));
                if (employeeId == null) {
                    continue;
                }
                jdbcTemplate.update(
                        "INSERT INTO customer_role_employee_visibility(role_id, ai_employee_id, visibility_type, can_consult, can_assign) " +
                                "VALUES (?, ?, 'visible', ?, ?) " +
                                "ON CONFLICT (role_id, ai_employee_id) DO UPDATE SET " +
                                "can_consult = EXCLUDED.can_consult, can_assign = EXCLUDED.can_assign, updated_at = CURRENT_TIMESTAMP",
                        roleId,
                        employeeId,
                        asBoolean(employee.get("canConsult")) ? 1 : 0,
                        asBoolean(employee.get("canAssign")) ? 1 : 0);
            }
        }
        return overview();
    }

    private Long asLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        String text = String.valueOf(value);
        if (text.trim().isEmpty()) {
            return null;
        }
        return Long.valueOf(text);
    }

    private boolean asBoolean(Object value) {
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue() != 0;
        }
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }
}
