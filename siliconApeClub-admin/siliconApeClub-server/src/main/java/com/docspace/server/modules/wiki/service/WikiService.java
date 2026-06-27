package com.docspace.server.modules.wiki.service;

import com.docspace.server.common.enums.UserRole;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.modules.wiki.dto.WikiPageRequest;
import com.docspace.server.modules.wiki.dto.WikiRelationRequest;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WikiService {

    private static final List<String> RELATION_TYPES = Arrays.asList(
            "references", "depends_on", "related_to", "supersedes", "duplicated_with");

    private final JdbcTemplate jdbcTemplate;
    private final JsonUtils jsonUtils;
    private final KnowledgeService knowledgeService;

    public List<Map<String, Object>> listPages(String status, String query, Long departmentId, String pageType) {
        String sql = "SELECT p.id, p.title, p.page_type, p.summary, p.status, p.sync_status, p.health_status, p.heat_score, " +
                "p.department_id, d.name AS department_name, p.owner_id, p.acl_policy_id, a.policy_name AS acl_policy_name, " +
                "a.security_level, p.current_version, p.updated_at, p.created_at, " +
                "(SELECT COUNT(1) FROM ks_acl_binding b WHERE b.policy_id = p.acl_policy_id) AS acl_binding_count, " +
                "(SELECT COUNT(1) FROM ks_wiki_relation r WHERE r.source_page_id = p.id OR r.target_page_id = p.id) AS relation_count " +
                "FROM ks_wiki_page p " +
                "LEFT JOIN ds_department d ON d.id = p.department_id " +
                "LEFT JOIN ks_acl_policy a ON a.id = p.acl_policy_id " +
                "WHERE p.deleted = 0";
        java.util.List<Object> args = new java.util.ArrayList<Object>();
        if (status != null && !status.trim().isEmpty()) {
            sql += " AND p.status = ?";
            args.add(status);
        }
        if (departmentId != null) {
            sql += " AND p.department_id = ?";
            args.add(departmentId);
        }
        if (pageType != null && !pageType.trim().isEmpty()) {
            sql += " AND p.page_type = ?";
            args.add(pageType.trim());
        }
        if (query != null && !query.trim().isEmpty()) {
            sql += " AND (p.title ILIKE ? OR p.summary ILIKE ? OR p.content ILIKE ?)";
            String like = "%" + query.trim() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql += " ORDER BY p.updated_at DESC, p.id DESC";
        return jdbcTemplate.query(sql, knowledgeService.rowMapper(), args.toArray());
    }

    public Map<String, Object> structure(String groupBy, String query, String status) {
        List<Map<String, Object>> pages = listPages(status, query, null, null);
        boolean departmentFirst = groupBy == null || groupBy.trim().isEmpty()
                || "department,pageType,status".equalsIgnoreCase(groupBy.trim());
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("groupBy", departmentFirst ? "department,pageType,status" : "pageType,status");
        result.put("filters", filters(query, status));
        result.put("groups", departmentFirst ? departmentTree(pages) : pageTypeTree(pages));
        result.put("total", pages.size());
        return result;
    }

    public Map<String, Object> getPage(Long id) {
        return jdbcTemplate.queryForObject(
                "SELECT p.id, p.title, p.page_type, p.summary, p.content, p.metadata_json, p.tags_json, p.owner_id, " +
                        "p.department_id, d.name AS department_name, p.acl_policy_id, a.policy_name AS acl_policy_name, " +
                        "a.security_level, p.current_version, p.status, p.sync_status, p.health_status, p.heat_score, " +
                        "p.created_by, p.created_at, p.updated_at, " +
                        "(SELECT COUNT(1) FROM ks_acl_binding b WHERE b.policy_id = p.acl_policy_id) AS acl_binding_count, " +
                        "(SELECT COUNT(1) FROM ks_wiki_relation r WHERE r.source_page_id = p.id OR r.target_page_id = p.id) AS relation_count " +
                        "FROM ks_wiki_page p " +
                        "LEFT JOIN ds_department d ON d.id = p.department_id " +
                        "LEFT JOIN ks_acl_policy a ON a.id = p.acl_policy_id " +
                        "WHERE p.id = ? AND p.deleted = 0",
                knowledgeService.rowMapper(), id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createPage(WikiPageRequest request, SecurityUser currentUser) {
        ensureWritable(currentUser);
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO ks_wiki_page(title, page_type, summary, content, metadata_json, tags_json, owner_id, department_id, acl_policy_id, created_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                request.getTitle(),
                defaultString(request.getPageType(), "general"),
                defaultString(request.getSummary(), ""),
                defaultString(request.getContent(), ""),
                jsonUtils.toJson(request.getMetadata() == null ? java.util.Collections.emptyMap() : request.getMetadata()),
                jsonUtils.toJson(request.getTags() == null ? java.util.Collections.emptyList() : request.getTags()),
                currentUser == null ? null : currentUser.getId(),
                request.getDepartmentId() == null && currentUser != null ? currentUser.getDepartmentId() : request.getDepartmentId(),
                request.getAclPolicyId() == null ? 1L : request.getAclPolicyId(),
                currentUser == null ? null : currentUser.getId());
        insertVersion(id, 1, request, currentUser, "draft", "创建 Wiki 页面");
        return getPage(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updatePage(Long id, WikiPageRequest request, SecurityUser currentUser) {
        ensureWritable(currentUser);
        Map<String, Object> current = getPage(id);
        int nextVersion = ((Number) current.get("currentVersion")).intValue() + 1;
        jdbcTemplate.update(
                "UPDATE ks_wiki_page SET title = ?, page_type = ?, summary = ?, content = ?, metadata_json = ?, tags_json = ?, " +
                        "department_id = ?, acl_policy_id = ?, current_version = ?, status = 'draft', sync_status = 'stale', updated_at = ? WHERE id = ?",
                request.getTitle(),
                defaultString(request.getPageType(), "general"),
                defaultString(request.getSummary(), ""),
                defaultString(request.getContent(), ""),
                jsonUtils.toJson(request.getMetadata() == null ? java.util.Collections.emptyMap() : request.getMetadata()),
                jsonUtils.toJson(request.getTags() == null ? java.util.Collections.emptyList() : request.getTags()),
                request.getDepartmentId(),
                request.getAclPolicyId() == null ? 1L : request.getAclPolicyId(),
                nextVersion,
                LocalDateTime.now(),
                id);
        insertVersion(id, nextVersion, request, currentUser, "draft", "更新 Wiki 页面");
        return getPage(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> publish(Long id, SecurityUser currentUser) {
        ensureWritable(currentUser);
        Map<String, Object> page = getPage(id);
        jdbcTemplate.update("UPDATE ks_wiki_page SET status = 'active', sync_status = 'indexing', updated_at = ? WHERE id = ?",
                LocalDateTime.now(), id);
        jdbcTemplate.update("UPDATE ks_wiki_page_version SET status = 'published' WHERE page_id = ? AND version = ?",
                id, page.get("currentVersion"));
        knowledgeService.syncWikiPage(id, currentUser);
        return getPage(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> archive(Long id, SecurityUser currentUser) {
        ensureWritable(currentUser);
        jdbcTemplate.update("UPDATE ks_wiki_page SET status = 'archived', sync_status = 'archived', updated_at = ? WHERE id = ?",
                LocalDateTime.now(), id);
        jdbcTemplate.update("UPDATE ks_chunk SET knowledge_status = 'archived', updated_at = ? WHERE wiki_page_id = ?",
                LocalDateTime.now(), id);
        return getPage(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id, SecurityUser currentUser) {
        ensureWritable(currentUser);
        jdbcTemplate.update("UPDATE ks_wiki_page SET deleted = 1, status = 'deleted', sync_status = 'archived', updated_at = ? WHERE id = ?",
                LocalDateTime.now(), id);
        jdbcTemplate.update("DELETE FROM ks_wiki_relation WHERE source_page_id = ? OR target_page_id = ?", id, id);
        jdbcTemplate.update("UPDATE ks_chunk SET knowledge_status = 'archived', updated_at = ? WHERE wiki_page_id = ?",
                LocalDateTime.now(), id);
    }

    public List<Map<String, Object>> listVersions(Long id) {
        return jdbcTemplate.query(
                "SELECT id, page_id, version, title, content, metadata_json, author_id, author_name, status, summary, created_at " +
                        "FROM ks_wiki_page_version WHERE page_id = ? ORDER BY version DESC",
                knowledgeService.rowMapper(), id);
    }

    public Map<String, Object> syncStatus(Long id) {
        return jdbcTemplate.queryForObject(
                "SELECT p.id AS page_id, p.current_version, p.sync_status, p.health_status, r.index_version, r.index_status, " +
                        "r.chunk_count, r.embedding_model, r.embedding_version, r.indexed_at, r.index_error " +
                        "FROM ks_wiki_page p LEFT JOIN ks_index_record r ON r.id = (" +
                        "SELECT id FROM ks_index_record WHERE wiki_page_id = p.id ORDER BY created_at DESC LIMIT 1) WHERE p.id = ?",
                knowledgeService.rowMapper(), id);
    }

    public List<Map<String, Object>> listRelations(Long pageId) {
        getPage(pageId);
        return jdbcTemplate.query(
                "SELECT r.id, r.source_page_id, s.title AS source_title, r.target_page_id, t.title AS target_title, " +
                        "r.relation_type, r.created_at, " +
                        "CASE WHEN r.source_page_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction " +
                        "FROM ks_wiki_relation r " +
                        "LEFT JOIN ks_wiki_page s ON s.id = r.source_page_id " +
                        "LEFT JOIN ks_wiki_page t ON t.id = r.target_page_id " +
                        "WHERE (r.source_page_id = ? OR r.target_page_id = ?) AND s.deleted = 0 AND t.deleted = 0 " +
                        "ORDER BY r.created_at DESC, r.id DESC",
                knowledgeService.rowMapper(), pageId, pageId, pageId);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createRelation(Long pageId, WikiRelationRequest request, SecurityUser currentUser) {
        ensureWritable(currentUser);
        getPage(pageId);
        getPage(request.getTargetPageId());
        if (pageId.equals(request.getTargetPageId())) {
            throw new BusinessException("Wiki 关系不能指向自身");
        }
        String relationType = normalizeRelationType(request.getRelationType());
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO ks_wiki_relation(source_page_id, target_page_id, relation_type) VALUES (?, ?, ?) RETURNING id",
                Long.class, pageId, request.getTargetPageId(), relationType);
        return jdbcTemplate.queryForObject(
                "SELECT r.id, r.source_page_id, s.title AS source_title, r.target_page_id, t.title AS target_title, " +
                        "r.relation_type, r.created_at, 'outgoing' AS direction " +
                        "FROM ks_wiki_relation r " +
                        "LEFT JOIN ks_wiki_page s ON s.id = r.source_page_id " +
                        "LEFT JOIN ks_wiki_page t ON t.id = r.target_page_id WHERE r.id = ?",
                knowledgeService.rowMapper(), id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteRelation(Long pageId, Long relationId, SecurityUser currentUser) {
        ensureWritable(currentUser);
        jdbcTemplate.update(
                "DELETE FROM ks_wiki_relation WHERE id = ? AND (source_page_id = ? OR target_page_id = ?)",
                relationId, pageId, pageId);
    }

    private void insertVersion(Long pageId, Integer version, WikiPageRequest request, SecurityUser currentUser, String status, String summary) {
        jdbcTemplate.update(
                "INSERT INTO ks_wiki_page_version(page_id, version, title, content, metadata_json, author_id, author_name, status, summary) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                pageId,
                version,
                request.getTitle(),
                defaultString(request.getContent(), ""),
                jsonUtils.toJson(request.getMetadata() == null ? java.util.Collections.emptyMap() : request.getMetadata()),
                currentUser == null ? null : currentUser.getId(),
                currentUser == null ? null : currentUser.getDisplayName(),
                status,
                summary);
    }

    private Map<String, Object> filters(String query, String status) {
        Map<String, Object> filters = new LinkedHashMap<String, Object>();
        filters.put("query", query == null ? "" : query);
        filters.put("status", status == null ? "" : status);
        return filters;
    }

    private List<Map<String, Object>> departmentTree(List<Map<String, Object>> pages) {
        Map<String, List<Map<String, Object>>> byDepartment = new LinkedHashMap<String, List<Map<String, Object>>>();
        for (Map<String, Object> page : pages) {
            String key = key(page.get("departmentId"), "未分配部门");
            if (!byDepartment.containsKey(key)) {
                byDepartment.put(key, new ArrayList<Map<String, Object>>());
            }
            byDepartment.get(key).add(page);
        }
        List<Map<String, Object>> groups = new ArrayList<Map<String, Object>>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : byDepartment.entrySet()) {
            Map<String, Object> node = groupNode("department", entry.getKey(), label(entry.getValue().get(0).get("departmentName"), entry.getKey()), entry.getValue().size());
            node.put("children", pageTypeNodes(entry.getValue()));
            groups.add(node);
        }
        return groups;
    }

    private List<Map<String, Object>> pageTypeTree(List<Map<String, Object>> pages) {
        return pageTypeNodes(pages);
    }

    private List<Map<String, Object>> pageTypeNodes(List<Map<String, Object>> pages) {
        Map<String, List<Map<String, Object>>> byType = new LinkedHashMap<String, List<Map<String, Object>>>();
        for (Map<String, Object> page : pages) {
            String key = key(page.get("pageType"), "general");
            if (!byType.containsKey(key)) {
                byType.put(key, new ArrayList<Map<String, Object>>());
            }
            byType.get(key).add(page);
        }
        List<Map<String, Object>> groups = new ArrayList<Map<String, Object>>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : byType.entrySet()) {
            Map<String, Object> node = groupNode("pageType", entry.getKey(), entry.getKey(), entry.getValue().size());
            node.put("children", statusNodes(entry.getValue()));
            groups.add(node);
        }
        return groups;
    }

    private List<Map<String, Object>> statusNodes(List<Map<String, Object>> pages) {
        Map<String, Integer> counts = new LinkedHashMap<String, Integer>();
        for (Map<String, Object> page : pages) {
            String key = key(page.get("status"), "unknown");
            counts.put(key, counts.containsKey(key) ? counts.get(key) + 1 : 1);
        }
        List<Map<String, Object>> groups = new ArrayList<Map<String, Object>>();
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            groups.add(groupNode("status", entry.getKey(), entry.getKey(), entry.getValue()));
        }
        return groups;
    }

    private Map<String, Object> groupNode(String type, String value, String label, Integer count) {
        Map<String, Object> node = new LinkedHashMap<String, Object>();
        node.put("type", type);
        node.put("value", value);
        node.put("label", label);
        node.put("count", count);
        node.put("children", new ArrayList<Map<String, Object>>());
        return node;
    }

    private String key(Object value, String fallback) {
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            return fallback;
        }
        return String.valueOf(value);
    }

    private String label(Object value, String fallback) {
        return value == null || String.valueOf(value).trim().isEmpty() ? fallback : String.valueOf(value);
    }

    private String normalizeRelationType(String relationType) {
        String value = relationType == null || relationType.trim().isEmpty() ? "related_to" : relationType.trim();
        if (!RELATION_TYPES.contains(value)) {
            throw new BusinessException("不支持的 Wiki 关系类型: " + value);
        }
        return value;
    }

    private void ensureWritable(SecurityUser currentUser) {
        Integer windows = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM ks_maintenance_window WHERE status = 'MAINTENANCE_WINDOW' AND ended_at IS NULL",
                Integer.class);
        if (windows != null && windows > 0 && (currentUser == null || currentUser.getRole() != UserRole.ADMIN)) {
            throw new BusinessException("当前处于知识静默巡检窗口，普通用户暂不可修改正式知识");
        }
    }

    private String defaultString(String value, String fallback) {
        return value == null ? fallback : value;
    }
}
