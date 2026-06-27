package com.docspace.server.modules.position.service;

import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.modules.position.dto.PositionPackageItemsRequest;
import com.docspace.server.modules.position.dto.PositionPackageRequest;
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
public class PositionPackageService {

    private final JdbcTemplate jdbcTemplate;
    private final JsonUtils jsonUtils;
    private final KnowledgeService knowledgeService;

    public List<Map<String, Object>> listPackages() {
        return jdbcTemplate.query(
                "SELECT id, code, name, description, position_code, default_scope_json, rules_json, status, created_by, created_at, updated_at " +
                        "FROM ks_position_package ORDER BY updated_at DESC",
                knowledgeService.rowMapper());
    }

    public Map<String, Object> getPackage(Long id) {
        Map<String, Object> result = jdbcTemplate.queryForObject(
                "SELECT id, code, name, description, position_code, default_scope_json, rules_json, status, created_by, created_at, updated_at " +
                        "FROM ks_position_package WHERE id = ?",
                knowledgeService.rowMapper(), id);
        result.put("items", listItems(id));
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> create(PositionPackageRequest request, SecurityUser currentUser) {
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO ks_position_package(code, name, description, position_code, default_scope_json, rules_json, created_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                request.getCode(),
                request.getName(),
                request.getDescription(),
                request.getPositionCode(),
                jsonUtils.toJson(request.getDefaultScope() == null ? java.util.Collections.emptyMap() : request.getDefaultScope()),
                jsonUtils.toJson(request.getRules() == null ? java.util.Collections.emptyMap() : request.getRules()),
                currentUser == null ? null : currentUser.getId());
        return getPackage(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> update(Long id, PositionPackageRequest request) {
        jdbcTemplate.update(
                "UPDATE ks_position_package SET code = ?, name = ?, description = ?, position_code = ?, default_scope_json = ?, rules_json = ?, " +
                        "status = 'draft', updated_at = ? WHERE id = ?",
                request.getCode(),
                request.getName(),
                request.getDescription(),
                request.getPositionCode(),
                jsonUtils.toJson(request.getDefaultScope() == null ? java.util.Collections.emptyMap() : request.getDefaultScope()),
                jsonUtils.toJson(request.getRules() == null ? java.util.Collections.emptyMap() : request.getRules()),
                LocalDateTime.now(),
                id);
        return getPackage(id);
    }

    public Map<String, Object> publish(Long id) {
        jdbcTemplate.update("UPDATE ks_position_package SET status = 'active', updated_at = ? WHERE id = ?",
                LocalDateTime.now(), id);
        return getPackage(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> replaceItems(Long id, PositionPackageItemsRequest request) {
        jdbcTemplate.update("DELETE FROM ks_position_package_item WHERE package_id = ?", id);
        if (request.getItems() != null) {
            for (PositionPackageItemsRequest.PositionPackageItemRequest item : request.getItems()) {
                jdbcTemplate.update(
                        "INSERT INTO ks_position_package_item(package_id, item_type, item_id, required, sort_order) VALUES (?, ?, ?, ?, ?)",
                        id,
                        item.getItemType() == null ? "wiki_page" : item.getItemType(),
                        item.getItemId(),
                        Boolean.TRUE.equals(item.getRequired()) ? 1 : 0,
                        item.getSortOrder() == null ? 0 : item.getSortOrder());
            }
        }
        return getPackage(id);
    }

    public List<Map<String, Object>> listItems(Long id) {
        return jdbcTemplate.query(
                "SELECT i.id, i.package_id, i.item_type, i.item_id, i.required, i.sort_order, p.title AS wiki_title, p.status AS wiki_status " +
                        "FROM ks_position_package_item i LEFT JOIN ks_wiki_page p ON p.id = i.item_id AND i.item_type = 'wiki_page' " +
                        "WHERE i.package_id = ? ORDER BY i.sort_order ASC, i.id ASC",
                knowledgeService.rowMapper(), id);
    }
}
