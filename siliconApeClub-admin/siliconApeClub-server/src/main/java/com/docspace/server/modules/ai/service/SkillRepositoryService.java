package com.docspace.server.modules.ai.service;

import com.docspace.server.common.enums.UserRole;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SkillRepositoryService {

    private final JdbcTemplate jdbcTemplate;
    private final KnowledgeService knowledgeService;

    public List<Map<String, Object>> list(String reviewStatus) {
        if (reviewStatus == null || reviewStatus.trim().isEmpty()) {
            return jdbcTemplate.query(baseSelect() + " ORDER BY s.updated_at DESC, s.id DESC", knowledgeService.rowMapper());
        }
        return jdbcTemplate.query(baseSelect() + " WHERE s.review_status = ? ORDER BY s.updated_at DESC, s.id DESC",
                knowledgeService.rowMapper(), reviewStatus.trim());
    }

    public Map<String, Object> get(Long id) {
        Map<String, Object> item = jdbcTemplate.queryForObject(baseSelect() + " WHERE s.id = ?", knowledgeService.rowMapper(), id);
        if (item == null) {
            throw new BusinessException("技能不存在");
        }
        item.put("bindings", bindings(id));
        return item;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> create(Map<String, Object> request, SecurityUser currentUser) {
        ensureAdvancedSkillAllowed(request, currentUser);
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO hr_skill_repository(code, name, description, department_id, skill_type, skill_level, invocation_mode, " +
                        "input_schema_json, output_schema_json, orchestration_config_json, guardrails_json, source_type, source_employee_id, " +
                        "review_status, enabled, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                requiredString(request, "code"),
                requiredString(request, "name"),
                asString(request.get("description")),
                asLong(request.get("departmentId")),
                defaultString(asString(request.get("skillType")), "tool"),
                defaultString(asString(request.get("skillLevel")), "basic"),
                defaultString(asString(request.get("invocationMode")), "tool_call"),
                defaultString(asString(request.get("inputSchemaJson")), "{}"),
                defaultString(asString(request.get("outputSchemaJson")), "{}"),
                defaultString(asString(request.get("orchestrationConfigJson")), "{}"),
                defaultString(asString(request.get("guardrailsJson")), "{}"),
                defaultString(asString(request.get("sourceType")), "human"),
                asLong(request.get("sourceEmployeeId")),
                defaultString(asString(request.get("reviewStatus")), "draft"),
                asBoolean(request.get("enabled")) ? 1 : 0,
                defaultString(asString(request.get("createdBy")), "admin"));
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> update(Long id, Map<String, Object> request, SecurityUser currentUser) {
        ensureSkillExists(id);
        ensureAdvancedSkillAllowed(request, currentUser);
        jdbcTemplate.update(
                "UPDATE hr_skill_repository SET code = ?, name = ?, description = ?, department_id = ?, skill_type = ?, skill_level = ?, " +
                        "invocation_mode = ?, input_schema_json = ?, output_schema_json = ?, orchestration_config_json = ?, guardrails_json = ?, " +
                        "source_type = ?, source_employee_id = ?, enabled = ?, updated_at = ? WHERE id = ?",
                requiredString(request, "code"),
                requiredString(request, "name"),
                asString(request.get("description")),
                asLong(request.get("departmentId")),
                defaultString(asString(request.get("skillType")), "tool"),
                defaultString(asString(request.get("skillLevel")), "basic"),
                defaultString(asString(request.get("invocationMode")), "tool_call"),
                defaultString(asString(request.get("inputSchemaJson")), "{}"),
                defaultString(asString(request.get("outputSchemaJson")), "{}"),
                defaultString(asString(request.get("orchestrationConfigJson")), "{}"),
                defaultString(asString(request.get("guardrailsJson")), "{}"),
                defaultString(asString(request.get("sourceType")), "human"),
                asLong(request.get("sourceEmployeeId")),
                asBoolean(request.get("enabled")) ? 1 : 0,
                LocalDateTime.now(),
                id);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> submitReview(Long id) {
        ensureSkillExists(id);
        jdbcTemplate.update("UPDATE hr_skill_repository SET review_status = 'pending_review', updated_at = ? WHERE id = ?",
                LocalDateTime.now(), id);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> approve(Long id, Map<String, Object> request, SecurityUser currentUser) {
        ensureSkillExists(id);
        ensureTopManagerForExistingAdvancedSkill(id, currentUser);
        jdbcTemplate.update(
                "UPDATE hr_skill_repository SET review_status = 'approved', reviewed_by = ?, reviewed_at = ?, enabled = 1, updated_at = ? WHERE id = ?",
                defaultString(asString(request == null ? null : request.get("reviewedBy")), "admin"),
                LocalDateTime.now(),
                LocalDateTime.now(),
                id);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> reject(Long id, Map<String, Object> request) {
        ensureSkillExists(id);
        jdbcTemplate.update(
                "UPDATE hr_skill_repository SET review_status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
                defaultString(asString(request == null ? null : request.get("reviewedBy")), "admin"),
                LocalDateTime.now(),
                LocalDateTime.now(),
                id);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> archive(Long id) {
        ensureSkillExists(id);
        jdbcTemplate.update("UPDATE hr_skill_repository SET review_status = 'archived', enabled = 0, updated_at = ? WHERE id = ?",
                LocalDateTime.now(), id);
        jdbcTemplate.update("UPDATE hr_skill_binding SET enabled = 0, updated_at = ? WHERE skill_id = ?", LocalDateTime.now(), id);
        return get(id);
    }

    private String baseSelect() {
        return "SELECT s.id, s.code, s.name, s.description, s.department_id, d.name AS department_name, s.skill_type, s.skill_level, " +
                "s.invocation_mode, s.input_schema_json, s.output_schema_json, s.orchestration_config_json, s.guardrails_json, " +
                "s.source_type, s.source_employee_id, e.name AS source_employee_name, s.review_status, s.enabled, s.created_by, " +
                "s.reviewed_by, s.reviewed_at, s.created_at, s.updated_at, " +
                "(SELECT COUNT(1) FROM hr_skill_binding b WHERE b.skill_id = s.id AND b.enabled = 1) AS binding_count " +
                "FROM hr_skill_repository s " +
                "LEFT JOIN ds_department d ON d.id = s.department_id " +
                "LEFT JOIN ds_ai_employee e ON e.id = s.source_employee_id";
    }

    private List<Map<String, Object>> bindings(Long id) {
        return jdbcTemplate.query(
                "SELECT b.id, b.ai_employee_id, e.name AS employee_name, e.role_title, d.name AS department_name, " +
                        "b.binding_scope, b.required, b.sort_order, b.enabled, b.created_at, b.updated_at " +
                        "FROM hr_skill_binding b " +
                        "JOIN ds_ai_employee e ON e.id = b.ai_employee_id " +
                        "LEFT JOIN ds_department d ON d.id = e.department_id " +
                        "WHERE b.skill_id = ? ORDER BY d.sort_order, e.name",
                knowledgeService.rowMapper(), id);
    }

    private void ensureSkillExists(Long id) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(1) FROM hr_skill_repository WHERE id = ?", Integer.class, id);
        if (count == null || count == 0) {
            throw new BusinessException("技能不存在");
        }
    }

    private String requiredString(Map<String, Object> request, String key) {
        String value = request == null ? null : asString(request.get(key));
        if (value == null || value.trim().isEmpty()) {
            throw new BusinessException("技能" + key + "不能为空");
        }
        return value.trim();
    }

    private String defaultString(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private Long asLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : Long.valueOf(text);
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private boolean asBoolean(Object value) {
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue() != 0;
        }
        return value == null || Boolean.parseBoolean(String.valueOf(value));
    }

    private void ensureAdvancedSkillAllowed(Map<String, Object> request, SecurityUser currentUser) {
        String skillLevel = defaultString(asString(request == null ? null : request.get("skillLevel")), "basic");
        if ("advanced".equals(skillLevel) && !isTopManager(currentUser)) {
            throw new BusinessException("高级技能仅允许顶级管理人员维护");
        }
    }

    private void ensureTopManagerForExistingAdvancedSkill(Long id, SecurityUser currentUser) {
        String skillLevel = jdbcTemplate.queryForObject(
                "SELECT skill_level FROM hr_skill_repository WHERE id = ?",
                String.class,
                id);
        if ("advanced".equals(skillLevel) && !isTopManager(currentUser)) {
            throw new BusinessException("高级技能仅允许顶级管理人员审核通过");
        }
    }

    private boolean isTopManager(SecurityUser currentUser) {
        return currentUser != null && currentUser.getRole() == UserRole.ADMIN;
    }
}
