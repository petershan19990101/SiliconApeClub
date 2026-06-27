package com.docspace.server.modules.knowledge.service;

import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.modules.knowledge.dto.PermissionCheckRequest;
import com.docspace.server.modules.knowledge.dto.SyncJobRequest;
import com.docspace.server.security.SecurityUser;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class KnowledgeService {

    private static final int EMBEDDING_DIMENSIONS = 1024;

    private final JdbcTemplate jdbcTemplate;
    private final JsonUtils jsonUtils;

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createSyncJob(SyncJobRequest request, SecurityUser currentUser) {
        Long jobId = jdbcTemplate.queryForObject(
                "INSERT INTO ks_sync_job(source_type, source_id, source_version, requested_by, requested_by_name) " +
                        "VALUES (?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                safeSourceType(request.getSourceType()),
                request.getSourceId(),
                request.getSourceVersion(),
                currentUser == null ? null : currentUser.getId(),
                currentUser == null ? null : currentUser.getDisplayName());
        return getSyncJob(jobId);
    }

    public Map<String, Object> getSyncJob(Long id) {
        return jdbcTemplate.queryForObject(
                "SELECT id, source_type, source_id, source_version, status, attempt_count, error_message, " +
                        "requested_by, requested_by_name, started_at, finished_at, created_at, updated_at " +
                        "FROM ks_sync_job WHERE id = ?",
                rowMapper(), id);
    }

    public List<Map<String, Object>> listCitations() {
        return jdbcTemplate.query(
                "SELECT id, trace_id, actor_type, actor_id, query_text, chunk_id, wiki_page_id, wiki_page_version, " +
                        "score, rerank_score, permission_matched_by, task_type, metadata_json, created_at " +
                        "FROM ks_citation_log ORDER BY created_at DESC LIMIT 100",
                rowMapper());
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> syncWikiPage(Long pageId, SecurityUser currentUser) {
        Map<String, Object> page = jdbcTemplate.queryForObject(
                "SELECT id, title, content, current_version, metadata_json, tags_json, department_id, acl_policy_id " +
                        "FROM ks_wiki_page WHERE id = ? AND deleted = 0",
                rowMapper(), pageId);
        if (page == null) {
            throw new BusinessException("Wiki 页面不存在");
        }

        Integer version = asInteger(page.get("currentVersion"));
        SyncJobRequest request = new SyncJobRequest();
        request.setSourceType("wiki_page");
        request.setSourceId(pageId);
        request.setSourceVersion(version);
        Map<String, Object> job = createSyncJob(request, currentUser);
        Long jobId = asLong(job.get("id"));

        jdbcTemplate.update("UPDATE ks_sync_job SET status = 'running', attempt_count = attempt_count + 1, started_at = ?, updated_at = ? WHERE id = ?",
                LocalDateTime.now(), LocalDateTime.now(), jobId);
        try {
            jdbcTemplate.update("UPDATE ks_chunk SET knowledge_status = 'deprecated', updated_at = ? WHERE wiki_page_id = ? AND knowledge_status = 'active'",
                    LocalDateTime.now(), pageId);
            List<String> chunks = splitContent(asString(page.get("content")));
            int indexVersion = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(MAX(index_version), 0) + 1 FROM ks_index_record WHERE wiki_page_id = ?",
                    Integer.class, pageId);
            int sequence = 0;
            for (String chunk : chunks) {
                sequence++;
                String hash = sha256(chunk);
                Map<String, Object> metadataMap = new LinkedHashMap<String, Object>();
                metadataMap.put("sequence", sequence);
                metadataMap.put("sourceTitle", page.get("title"));
                metadataMap.put("source", "wiki_page");
                String metadata = jsonUtils.toJson(metadataMap);
                jdbcTemplate.update(
                        "INSERT INTO ks_chunk(source_type, source_id, source_version, wiki_page_id, wiki_page_version, " +
                                "content_hash, chunk_text, chunk_summary, metadata_json, acl_policy_id, acl_version, security_level, " +
                                "department_tags, knowledge_status, embedding_model, embedding_version, embedding, index_version) " +
                                "VALUES ('wiki_page', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'internal', ?, 'active', 'text-embedding-v4', 'mvp-local-hash', CAST(? AS vector), ?)",
                        pageId,
                        version,
                        pageId,
                        version,
                        hash,
                        chunk,
                        summarize(chunk),
                        metadata,
                        page.get("aclPolicyId") == null ? 1L : asLong(page.get("aclPolicyId")),
                        page.get("departmentId") == null ? "" : String.valueOf(page.get("departmentId")),
                        deterministicEmbedding(chunk),
                        indexVersion);
            }
            jdbcTemplate.update(
                    "INSERT INTO ks_index_record(source_type, source_id, source_version, wiki_page_id, wiki_page_version, content_hash, " +
                            "chunk_count, embedding_model, embedding_version, index_version, index_status, indexed_at) " +
                            "VALUES ('wiki_page', ?, ?, ?, ?, ?, ?, 'text-embedding-v4', 'mvp-local-hash', ?, 'success', ?)",
                    pageId, version, pageId, version, sha256(asString(page.get("content"))), chunks.size(), indexVersion, LocalDateTime.now());
            jdbcTemplate.update("UPDATE ks_wiki_page SET sync_status = 'synced', health_status = 'normal', updated_at = ? WHERE id = ?",
                    LocalDateTime.now(), pageId);
            jdbcTemplate.update("UPDATE ks_sync_job SET status = 'success', finished_at = ?, updated_at = ? WHERE id = ?",
                    LocalDateTime.now(), LocalDateTime.now(), jobId);
        } catch (Exception ex) {
            jdbcTemplate.update("UPDATE ks_wiki_page SET sync_status = 'failed', updated_at = ? WHERE id = ?",
                    LocalDateTime.now(), pageId);
            jdbcTemplate.update("UPDATE ks_sync_job SET status = 'failed', error_message = ?, finished_at = ?, updated_at = ? WHERE id = ?",
                    ex.getMessage(), LocalDateTime.now(), LocalDateTime.now(), jobId);
            throw new BusinessException("知识同步失败: " + ex.getMessage());
        }
        return getSyncJob(jobId);
    }

    public Map<String, Object> checkChunkPermission(Long chunkId, PermissionCheckRequest request) {
        Map<String, Object> chunk = jdbcTemplate.queryForObject(
                "SELECT c.id, c.acl_policy_id, c.security_level, c.department_tags, c.position_tags, c.knowledge_status, p.status AS policy_status " +
                        "FROM ks_chunk c LEFT JOIN ks_acl_policy p ON p.id = c.acl_policy_id WHERE c.id = ?",
                rowMapper(), chunkId);
        boolean allowed = chunk != null && "active".equalsIgnoreCase(asString(chunk.get("knowledgeStatus")))
                && !"disabled".equalsIgnoreCase(asString(chunk.get("policyStatus")));
        String matchedBy = "policy";
        if (allowed && request != null && request.getDepartmentId() != null
                && asString(chunk.get("departmentTags")).contains(request.getDepartmentId())) {
            matchedBy = "department";
        }
        if (allowed && request != null && request.getPositionCode() != null
                && asString(chunk.get("positionTags")).contains(request.getPositionCode())) {
            matchedBy = "position";
        }
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("allowed", allowed);
        result.put("permissionMatchedBy", matchedBy);
        result.put("chunkId", chunkId);
        return result;
    }

    public void recordCitation(Map<String, Object> body) {
        jdbcTemplate.update(
                "INSERT INTO ks_citation_log(trace_id, actor_type, actor_id, query_text, chunk_id, wiki_page_id, wiki_page_version, " +
                        "score, rerank_score, permission_matched_by, task_type, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                value(body, "traceId"),
                value(body, "actorType"),
                value(body, "actorId"),
                value(body, "queryText"),
                longOrNull(value(body, "chunkId")),
                longOrNull(value(body, "wikiPageId")),
                intOrNull(value(body, "wikiPageVersion")),
                decimalOrNull(value(body, "score")),
                decimalOrNull(value(body, "rerankScore")),
                value(body, "permissionMatchedBy"),
                value(body, "taskType"),
                jsonUtils.toJson(body));
    }

    public RowMapper<Map<String, Object>> rowMapper() {
        return new RowMapper<Map<String, Object>>() {
            @Override
            public Map<String, Object> mapRow(ResultSet rs, int rowNum) throws SQLException {
                Map<String, Object> map = new LinkedHashMap<String, Object>();
                int count = rs.getMetaData().getColumnCount();
                for (int i = 1; i <= count; i++) {
                    map.put(toCamel(rs.getMetaData().getColumnLabel(i)), rs.getObject(i));
                }
                return map;
            }
        };
    }

    public String deterministicEmbedding(String text) {
        Random random = new Random(text == null ? 0 : text.hashCode());
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < EMBEDDING_DIMENSIONS; i++) {
            if (i > 0) {
                builder.append(',');
            }
            double value = (random.nextDouble() - 0.5d) / 10d;
            builder.append(String.format(Locale.US, "%.6f", value));
        }
        builder.append(']');
        return builder.toString();
    }

    private List<String> splitContent(String content) {
        String safe = content == null ? "" : content.trim();
        List<String> chunks = new ArrayList<String>();
        if (safe.isEmpty()) {
            chunks.add("空白知识页面");
            return chunks;
        }
        String[] paragraphs = safe.split("\\n\\s*\\n");
        StringBuilder current = new StringBuilder();
        for (String paragraph : paragraphs) {
            String item = paragraph.trim();
            if (item.isEmpty()) {
                continue;
            }
            if (current.length() + item.length() > 1200 && current.length() > 0) {
                chunks.add(current.toString());
                current.setLength(0);
            }
            if (current.length() > 0) {
                current.append("\n\n");
            }
            current.append(item);
        }
        if (current.length() > 0) {
            chunks.add(current.toString());
        }
        return chunks.isEmpty() ? java.util.Collections.singletonList(safe) : chunks;
    }

    private String summarize(String chunk) {
        if (chunk == null) {
            return "";
        }
        return chunk.length() > 160 ? chunk.substring(0, 160) : chunk;
    }

    private String safeSourceType(String sourceType) {
        if (!"wiki_page".equals(sourceType) && !"document".equals(sourceType)) {
            throw new BusinessException("不支持的知识同步来源类型: " + sourceType);
        }
        return sourceType;
    }

    private String sha256(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((text == null ? "" : text).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte item : hash) {
                hex.append(String.format("%02x", item));
            }
            return hex.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("hash failed", ex);
        }
    }

    private String toCamel(String value) {
        StringBuilder builder = new StringBuilder();
        boolean upper = false;
        for (char item : value.toCharArray()) {
            if (item == '_') {
                upper = true;
            } else if (upper) {
                builder.append(Character.toUpperCase(item));
                upper = false;
            } else {
                builder.append(item);
            }
        }
        return builder.toString();
    }

    private Object value(Map<String, Object> map, String key) {
        return map == null ? null : map.get(key);
    }

    private Long asLong(Object value) {
        return value instanceof Number ? ((Number) value).longValue() : Long.valueOf(String.valueOf(value));
    }

    private Integer asInteger(Object value) {
        return value instanceof Number ? ((Number) value).intValue() : Integer.valueOf(String.valueOf(value));
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private Long longOrNull(Object value) {
        return value == null ? null : Long.valueOf(String.valueOf(value));
    }

    private Integer intOrNull(Object value) {
        return value == null ? null : Integer.valueOf(String.valueOf(value));
    }

    private java.math.BigDecimal decimalOrNull(Object value) {
        return value == null ? null : new java.math.BigDecimal(String.valueOf(value));
    }
}
