package com.docspace.server.modules.wiki.service;

import com.docspace.server.common.enums.UserRole;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.modules.wiki.dto.WikiPageRequest;
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
public class WikiService {

    private final JdbcTemplate jdbcTemplate;
    private final JsonUtils jsonUtils;
    private final KnowledgeService knowledgeService;

    public List<Map<String, Object>> listPages(String status, String query) {
        String sql = "SELECT id, title, page_type, summary, status, sync_status, health_status, heat_score, " +
                "department_id, owner_id, current_version, updated_at, created_at FROM ks_wiki_page WHERE deleted = 0";
        java.util.List<Object> args = new java.util.ArrayList<Object>();
        if (status != null && !status.trim().isEmpty()) {
            sql += " AND status = ?";
            args.add(status);
        }
        if (query != null && !query.trim().isEmpty()) {
            sql += " AND (title ILIKE ? OR summary ILIKE ? OR content ILIKE ?)";
            String like = "%" + query.trim() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql += " ORDER BY updated_at DESC, id DESC";
        return jdbcTemplate.query(sql, knowledgeService.rowMapper(), args.toArray());
    }

    public Map<String, Object> getPage(Long id) {
        return jdbcTemplate.queryForObject(
                "SELECT id, title, page_type, summary, content, metadata_json, tags_json, owner_id, department_id, acl_policy_id, " +
                        "current_version, status, sync_status, health_status, heat_score, created_by, created_at, updated_at " +
                        "FROM ks_wiki_page WHERE id = ? AND deleted = 0",
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
