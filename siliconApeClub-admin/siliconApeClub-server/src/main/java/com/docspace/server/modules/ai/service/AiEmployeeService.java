package com.docspace.server.modules.ai.service;

import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.common.enums.UserRole;
import com.docspace.server.modules.ai.dto.AiEmployeePackagesRequest;
import com.docspace.server.modules.ai.dto.AiEmployeeRequest;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.security.SecurityUser;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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
                        "e.employment_type, e.cost_rate, e.performance_status, e.enabled, e.status, e.offline_reason, e.left_at, " +
                        "(SELECT COUNT(1) FROM hr_skill_binding sb JOIN hr_skill_repository sr ON sr.id = sb.skill_id " +
                        " WHERE sb.ai_employee_id = e.id AND sb.enabled = 1 AND sr.review_status = 'approved' AND sr.enabled = 1) AS skill_count, " +
                        "(SELECT COALESCE(SUM(total_tokens), 0) FROM hr_employee_usage_meter u WHERE u.ai_employee_id = e.id) AS total_tokens, " +
                        "(SELECT COALESCE(SUM(memory_items), 0) FROM hr_employee_usage_meter u WHERE u.ai_employee_id = e.id) AS memory_items, " +
                        "e.created_at, e.updated_at " +
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
                        "e.employment_type, e.cost_rate, e.performance_status, e.enabled, e.status, e.offline_reason, e.left_at, " +
                        "(SELECT COUNT(1) FROM hr_skill_binding sb JOIN hr_skill_repository sr ON sr.id = sb.skill_id " +
                        " WHERE sb.ai_employee_id = e.id AND sb.enabled = 1 AND sr.review_status = 'approved' AND sr.enabled = 1) AS skill_count, " +
                        "(SELECT COALESCE(SUM(total_tokens), 0) FROM hr_employee_usage_meter u WHERE u.ai_employee_id = e.id) AS total_tokens, " +
                        "(SELECT COALESCE(SUM(memory_items), 0) FROM hr_employee_usage_meter u WHERE u.ai_employee_id = e.id) AS memory_items, " +
                        "e.created_at, e.updated_at " +
                        "FROM ds_ai_employee e " +
                        "LEFT JOIN ds_department d ON d.id = e.department_id " +
                        "LEFT JOIN ds_ai_employee manager ON manager.id = e.manager_employee_id " +
                        "WHERE e.id = ?",
                knowledgeService.rowMapper(), id);
        item.put("packages", packages(id));
        item.put("contacts", contacts(id));
        item.put("skills", skills(id));
        item.put("assessmentRules", assessmentRules(id));
        item.put("performance", performance(id));
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

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> replaceSkills(Long id, Map<String, Object> request, SecurityUser currentUser) {
        ensureEmployeeExists(id);
        ensureAdvancedSkillsAllowed(request, currentUser);
        jdbcTemplate.update("DELETE FROM hr_skill_binding WHERE ai_employee_id = ?", id);
        Object skillIds = request == null ? null : request.get("skillIds");
        if (skillIds instanceof List) {
            int sortOrder = 10;
            for (Object item : (List<?>) skillIds) {
                Long skillId = asLong(item);
                if (skillId == null) {
                    continue;
                }
                jdbcTemplate.update(
                        "INSERT INTO hr_skill_binding(ai_employee_id, skill_id, sort_order) " +
                                "SELECT ?, id, ? FROM hr_skill_repository WHERE id = ? AND review_status = 'approved' AND enabled = 1 " +
                                "ON CONFLICT (ai_employee_id, skill_id) DO UPDATE SET enabled = 1, sort_order = EXCLUDED.sort_order, updated_at = ?",
                        id, sortOrder, skillId, LocalDateTime.now());
                sortOrder += 10;
            }
        }
        syncSkillsJson(id);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> replaceAssessmentRules(Long id, Map<String, Object> request) {
        ensureEmployeeExists(id);
        jdbcTemplate.update("DELETE FROM hr_employee_assessment_rule WHERE ai_employee_id = ?", id);
        Object rules = request == null ? null : request.get("rules");
        if (rules instanceof List) {
            for (Object item : (List<?>) rules) {
                if (!(item instanceof Map)) {
                    continue;
                }
                Map<?, ?> rule = (Map<?, ?>) item;
                String metricKey = defaultString(asString(rule.get("metricKey")), "");
                String metricLabel = defaultString(asString(rule.get("metricLabel")), metricKey);
                if (metricKey.isEmpty() || metricLabel.isEmpty()) {
                    continue;
                }
                jdbcTemplate.update(
                        "INSERT INTO hr_employee_assessment_rule(ai_employee_id, metric_key, metric_label, metric_type, target_value, weight, unit, enabled) " +
                                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        id,
                        metricKey,
                        metricLabel,
                        defaultString(asString(rule.get("metricType")), "count"),
                        defaultDecimal(asBigDecimal(rule.get("targetValue"))),
                        defaultDecimal(asBigDecimal(rule.get("weight"))).compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ONE : defaultDecimal(asBigDecimal(rule.get("weight"))),
                        defaultString(asString(rule.get("unit")), "count"),
                        asBoolean(rule.get("enabled")) ? 1 : 0);
            }
        }
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> recordUsage(Long id, Map<String, Object> request) {
        ensureEmployeeExists(id);
        long inputTokens = asLongValue(request == null ? null : request.get("inputTokens"));
        long outputTokens = asLongValue(request == null ? null : request.get("outputTokens"));
        long totalTokens = asLongValue(request == null ? null : request.get("totalTokens"));
        if (totalTokens <= 0) {
            totalTokens = inputTokens + outputTokens;
        }
        jdbcTemplate.update(
                "INSERT INTO hr_employee_usage_meter(ai_employee_id, usage_date, source_type, source_id, input_tokens, output_tokens, total_tokens, " +
                        "memory_bytes, memory_items, cost_amount, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                request != null && request.get("usageDate") != null ? Date.valueOf(String.valueOf(request.get("usageDate"))) : Date.valueOf(java.time.LocalDate.now()),
                defaultString(asString(request == null ? null : request.get("sourceType")), "manual"),
                asString(request == null ? null : request.get("sourceId")),
                inputTokens,
                outputTokens,
                totalTokens,
                asLongValue(request == null ? null : request.get("memoryBytes")),
                asLongValue(request == null ? null : request.get("memoryItems")),
                defaultDecimal(asBigDecimal(request == null ? null : request.get("costAmount"))),
                asString(request == null ? null : request.get("metadataJson")));
        return performance(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> offline(Long id, Map<String, Object> request) {
        ensureEmployeeExists(id);
        String reason = defaultString(asString(request == null ? null : request.get("reason")), "离职/下线");
        LocalDateTime now = LocalDateTime.now();
        jdbcTemplate.update(
                "UPDATE ds_ai_employee SET enabled = 0, status = 'OFFLINE', performance_status = 'offline', offline_reason = ?, left_at = ?, updated_at = ? WHERE id = ?",
                reason, now, now, id);
        jdbcTemplate.update("DELETE FROM customer_employee_visibility WHERE ai_employee_id = ?", id);
        jdbcTemplate.update("DELETE FROM ks_runtime_session WHERE ai_employee_id = ?", id);
        jdbcTemplate.update("DELETE FROM ks_task_memory WHERE ai_employee_id = ?", id);
        jdbcTemplate.update("UPDATE hr_skill_binding SET enabled = 0, updated_at = ? WHERE ai_employee_id = ?", now, id);
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

    public List<Map<String, Object>> skills(Long id) {
        return jdbcTemplate.query(
                "SELECT b.id, b.ai_employee_id, b.skill_id, s.code, s.name, s.description, s.department_id, d.name AS department_name, " +
                        "s.skill_type, s.skill_level, s.invocation_mode, s.review_status, b.required, b.sort_order, b.enabled, b.created_at, b.updated_at " +
                        "FROM hr_skill_binding b " +
                        "JOIN hr_skill_repository s ON s.id = b.skill_id " +
                        "LEFT JOIN ds_department d ON d.id = s.department_id " +
                        "WHERE b.ai_employee_id = ? AND b.enabled = 1 ORDER BY b.sort_order, s.name",
                knowledgeService.rowMapper(), id);
    }

    public List<Map<String, Object>> assessmentRules(Long id) {
        return jdbcTemplate.query(
                "SELECT id, ai_employee_id, metric_key, metric_label, metric_type, target_value, weight, unit, enabled, created_at, updated_at " +
                        "FROM hr_employee_assessment_rule WHERE ai_employee_id = ? ORDER BY metric_key",
                knowledgeService.rowMapper(), id);
    }

    public Map<String, Object> performance(Long id) {
        ensureEmployeeExists(id);
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        Map<String, Object> usage = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens, " +
                        "COALESCE(SUM(total_tokens), 0) AS total_tokens, COALESCE(SUM(memory_bytes), 0) AS memory_bytes, " +
                        "COALESCE(SUM(memory_items), 0) AS memory_items, COALESCE(SUM(cost_amount), 0) AS cost_amount " +
                        "FROM hr_employee_usage_meter WHERE ai_employee_id = ?",
                knowledgeService.rowMapper(), id);
        List<Map<String, Object>> rules = jdbcTemplate.query(
                "SELECT r.id, r.metric_key, r.metric_label, r.metric_type, r.target_value, r.weight, r.unit, r.enabled, " +
                        "COALESCE((SELECT SUM(metric_value) FROM hr_employee_metric_snapshot m WHERE m.ai_employee_id = r.ai_employee_id AND m.metric_key = r.metric_key), 0) AS actual_value " +
                        "FROM hr_employee_assessment_rule r WHERE r.ai_employee_id = ? AND r.enabled = 1 ORDER BY r.metric_key",
                knowledgeService.rowMapper(), id);
        result.put("usage", usage);
        result.put("rules", rules);
        result.put("taskMemoryCount", countSafe("SELECT COUNT(1) FROM ks_task_memory WHERE ai_employee_id = ?", id));
        result.put("wikiProposalCount", countSafe("SELECT COUNT(1) FROM ks_wiki_proposal WHERE created_by_actor_type = 'ai_employee' AND created_by_actor_id = ?", String.valueOf(id)));
        result.put("workerTaskCount", countSafe("SELECT COUNT(1) FROM wp_task_run WHERE assigned_employee_id = ?", "employee-admin-" + id));
        result.put("approvedSkillCount", countSafe(
                "SELECT COUNT(1) FROM hr_skill_binding b JOIN hr_skill_repository s ON s.id = b.skill_id WHERE b.ai_employee_id = ? AND b.enabled = 1 AND s.review_status = 'approved'",
                id));
        return result;
    }

    private String defaultString(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private BigDecimal defaultDecimal(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private void ensureEmployeeExists(Long id) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(1) FROM ds_ai_employee WHERE id = ?", Integer.class, id);
        if (count == null || count == 0) {
            throw new BusinessException("AI 员工不存在");
        }
    }

    private void syncSkillsJson(Long id) {
        List<String> names = jdbcTemplate.queryForList(
                "SELECT s.name FROM hr_skill_binding b JOIN hr_skill_repository s ON s.id = b.skill_id " +
                        "WHERE b.ai_employee_id = ? AND b.enabled = 1 AND s.enabled = 1 ORDER BY b.sort_order, s.name",
                String.class, id);
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < names.size(); i++) {
            if (i > 0) {
                builder.append(',');
            }
            builder.append('"').append(names.get(i).replace("\\", "\\\\").replace("\"", "\\\"")).append('"');
        }
        builder.append(']');
        jdbcTemplate.update("UPDATE ds_ai_employee SET skills_json = ?, updated_at = ? WHERE id = ?", builder.toString(), LocalDateTime.now(), id);
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

    private long asLongValue(Object value) {
        Long parsed = asLong(value);
        return parsed == null ? 0L : parsed;
    }

    private BigDecimal asBigDecimal(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal) {
            return (BigDecimal) value;
        }
        if (value instanceof Number) {
            return BigDecimal.valueOf(((Number) value).doubleValue());
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : new BigDecimal(text);
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

    private long countSafe(String sql, Object parameter) {
        try {
            Long count = jdbcTemplate.queryForObject(sql, Long.class, parameter);
            return count == null ? 0L : count;
        } catch (Exception ex) {
            return 0L;
        }
    }

    private void ensureAdvancedSkillsAllowed(Map<String, Object> request, SecurityUser currentUser) {
        Object skillIds = request == null ? null : request.get("skillIds");
        if (!(skillIds instanceof List) || isTopManager(currentUser)) {
            return;
        }
        List<Long> parsedIds = new ArrayList<Long>();
        for (Object item : (List<?>) skillIds) {
            Long id = asLong(item);
            if (id != null) {
                parsedIds.add(id);
            }
        }
        if (parsedIds.isEmpty()) {
            return;
        }
        StringBuilder placeholders = new StringBuilder();
        List<Object> args = new ArrayList<Object>();
        for (Long id : parsedIds) {
            if (placeholders.length() > 0) {
                placeholders.append(',');
            }
            placeholders.append('?');
            args.add(id);
        }
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM hr_skill_repository WHERE skill_level = 'advanced' AND id IN (" + placeholders + ")",
                Integer.class,
                args.toArray());
        if (count != null && count > 0) {
            throw new BusinessException("高级技能仅允许顶级管理人员绑定");
        }
    }

    private boolean isTopManager(SecurityUser currentUser) {
        return currentUser != null && currentUser.getRole() == UserRole.ADMIN;
    }
}
