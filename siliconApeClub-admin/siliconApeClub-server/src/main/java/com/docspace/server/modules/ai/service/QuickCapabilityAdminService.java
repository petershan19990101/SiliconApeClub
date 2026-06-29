package com.docspace.server.modules.ai.service;

import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class QuickCapabilityAdminService {

    private final JdbcTemplate jdbcTemplate;
    private final KnowledgeService knowledgeService;

    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("groups", jdbcTemplate.query(
                "SELECT id, group_code, group_name, description, group_sort, visible_to_external, visible_to_internal, " +
                        "enabled, created_at, updated_at FROM client_quick_capability_group ORDER BY group_sort, id",
                knowledgeService.rowMapper()));
        result.put("capabilities", jdbcTemplate.query(
                "SELECT c.id, c.group_id, g.group_code, g.group_name, g.group_sort, c.capability_code, c.capability_name, " +
                        "c.description, c.transaction_service_code, c.action_code, c.form_title, c.submit_label, " +
                        "c.input_schema_json, c.display_html, c.keywords_json, c.visible_to_external, c.visible_to_internal, " +
                        "c.enabled, c.sort_order, c.created_at, c.updated_at " +
                        "FROM client_quick_capability c " +
                        "JOIN client_quick_capability_group g ON g.id = c.group_id " +
                        "ORDER BY g.group_sort, c.sort_order, c.id",
                knowledgeService.rowMapper()));
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createGroup(Map<String, Object> request) {
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO client_quick_capability_group(group_code, group_name, description, group_sort, visible_to_external, visible_to_internal, enabled) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                requiredString(request, "groupCode"),
                requiredString(request, "groupName"),
                asString(request.get("description")),
                asInteger(request.get("groupSort"), 100),
                asBoolean(request.get("visibleToExternal"), true) ? 1 : 0,
                asBoolean(request.get("visibleToInternal"), true) ? 1 : 0,
                asBoolean(request.get("enabled"), true) ? 1 : 0);
        return overviewWithSelected("groupId", id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updateGroup(Long id, Map<String, Object> request) {
        ensureGroupExists(id);
        jdbcTemplate.update(
                "UPDATE client_quick_capability_group SET group_code = ?, group_name = ?, description = ?, group_sort = ?, " +
                        "visible_to_external = ?, visible_to_internal = ?, enabled = ?, updated_at = ? WHERE id = ?",
                requiredString(request, "groupCode"),
                requiredString(request, "groupName"),
                asString(request.get("description")),
                asInteger(request.get("groupSort"), 100),
                asBoolean(request.get("visibleToExternal"), true) ? 1 : 0,
                asBoolean(request.get("visibleToInternal"), true) ? 1 : 0,
                asBoolean(request.get("enabled"), true) ? 1 : 0,
                LocalDateTime.now(),
                id);
        return overviewWithSelected("groupId", id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createCapability(Map<String, Object> request) {
        Long groupId = resolveGroupId(request);
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO client_quick_capability(group_id, capability_code, capability_name, description, transaction_service_code, action_code, " +
                        "form_title, submit_label, input_schema_json, display_html, keywords_json, visible_to_external, visible_to_internal, enabled, sort_order) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                groupId,
                requiredString(request, "capabilityCode"),
                requiredString(request, "capabilityName"),
                asString(request.get("description")),
                requiredString(request, "transactionServiceCode"),
                requiredString(request, "actionCode"),
                defaultString(asString(request.get("formTitle")), requiredString(request, "capabilityName")),
                defaultString(asString(request.get("submitLabel")), "提交"),
                defaultString(asString(request.get("inputSchemaJson")), "{}"),
                asString(request.get("displayHtml")),
                defaultString(asString(request.get("keywordsJson")), "[]"),
                asBoolean(request.get("visibleToExternal"), true) ? 1 : 0,
                asBoolean(request.get("visibleToInternal"), true) ? 1 : 0,
                asBoolean(request.get("enabled"), true) ? 1 : 0,
                asInteger(request.get("sortOrder"), 100));
        return overviewWithSelected("capabilityId", id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updateCapability(Long id, Map<String, Object> request) {
        ensureCapabilityExists(id);
        Long groupId = resolveGroupId(request);
        jdbcTemplate.update(
                "UPDATE client_quick_capability SET group_id = ?, capability_code = ?, capability_name = ?, description = ?, " +
                        "transaction_service_code = ?, action_code = ?, form_title = ?, submit_label = ?, input_schema_json = ?, " +
                        "display_html = ?, keywords_json = ?, visible_to_external = ?, visible_to_internal = ?, enabled = ?, sort_order = ?, " +
                        "updated_at = ? WHERE id = ?",
                groupId,
                requiredString(request, "capabilityCode"),
                requiredString(request, "capabilityName"),
                asString(request.get("description")),
                requiredString(request, "transactionServiceCode"),
                requiredString(request, "actionCode"),
                defaultString(asString(request.get("formTitle")), requiredString(request, "capabilityName")),
                defaultString(asString(request.get("submitLabel")), "提交"),
                defaultString(asString(request.get("inputSchemaJson")), "{}"),
                asString(request.get("displayHtml")),
                defaultString(asString(request.get("keywordsJson")), "[]"),
                asBoolean(request.get("visibleToExternal"), true) ? 1 : 0,
                asBoolean(request.get("visibleToInternal"), true) ? 1 : 0,
                asBoolean(request.get("enabled"), true) ? 1 : 0,
                asInteger(request.get("sortOrder"), 100),
                LocalDateTime.now(),
                id);
        return overviewWithSelected("capabilityId", id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> setCapabilityEnabled(Long id, boolean enabled) {
        ensureCapabilityExists(id);
        jdbcTemplate.update("UPDATE client_quick_capability SET enabled = ?, updated_at = ? WHERE id = ?",
                enabled ? 1 : 0, LocalDateTime.now(), id);
        return overviewWithSelected("capabilityId", id);
    }

    private Map<String, Object> overviewWithSelected(String key, Long value) {
        Map<String, Object> result = overview();
        result.put(key, value);
        return result;
    }

    private Long resolveGroupId(Map<String, Object> request) {
        Long groupId = asLong(request.get("groupId"));
        if (groupId != null) {
            ensureGroupExists(groupId);
            return groupId;
        }
        String groupCode = asString(request.get("groupCode"));
        if (groupCode == null || groupCode.trim().isEmpty()) {
            throw new BusinessException("快捷能力分组不能为空");
        }
        Long value = jdbcTemplate.queryForObject(
                "SELECT id FROM client_quick_capability_group WHERE group_code = ?",
                Long.class,
                groupCode.trim());
        if (value == null) {
            throw new BusinessException("快捷能力分组不存在");
        }
        return value;
    }

    private void ensureGroupExists(Long id) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(1) FROM client_quick_capability_group WHERE id = ?", Integer.class, id);
        if (count == null || count == 0) {
            throw new BusinessException("快捷能力分组不存在");
        }
    }

    private void ensureCapabilityExists(Long id) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(1) FROM client_quick_capability WHERE id = ?", Integer.class, id);
        if (count == null || count == 0) {
            throw new BusinessException("快捷能力不存在");
        }
    }

    private String requiredString(Map<String, Object> request, String key) {
        String value = request == null ? null : asString(request.get(key));
        if (value == null || value.trim().isEmpty()) {
            throw new BusinessException("快捷能力配置缺少字段: " + key);
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

    private Integer asInteger(Object value, int fallback) {
        if (value == null) {
            return fallback;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? fallback : Integer.valueOf(text);
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private boolean asBoolean(Object value, boolean fallback) {
        if (value == null) {
            return fallback;
        }
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue() != 0;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }
}
