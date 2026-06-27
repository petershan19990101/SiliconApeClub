package com.docspace.server.modules.knowledge.service;

import com.docspace.server.common.exception.BusinessException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RagManagementService {

    private final JdbcTemplate jdbcTemplate;
    private final KnowledgeService knowledgeService;

    public List<Map<String, Object>> listPolicies() {
        return jdbcTemplate.query(
                "SELECT p.id, p.policy_name, p.security_level, p.acl_version, p.status, p.created_at, p.updated_at, " +
                        "(SELECT COUNT(1) FROM ks_acl_binding b WHERE b.policy_id = p.id) AS binding_count, " +
                        "(SELECT COUNT(1) FROM ks_chunk c WHERE c.acl_policy_id = p.id AND c.knowledge_status = 'active') AS active_chunk_count " +
                        "FROM ks_acl_policy p ORDER BY p.updated_at DESC, p.id DESC",
                knowledgeService.rowMapper());
    }

    public Map<String, Object> getPolicy(Long id) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT id, policy_name, security_level, acl_version, status, created_at, updated_at " +
                            "FROM ks_acl_policy WHERE id = ?",
                    knowledgeService.rowMapper(), id);
        } catch (EmptyResultDataAccessException ex) {
            throw new BusinessException("RAG 权限策略不存在");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createPolicy(Map<String, Object> request) {
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO ks_acl_policy(policy_name, security_level, status) VALUES (?, ?, ?) RETURNING id",
                Long.class,
                stringValue(request, "policyName", "未命名 RAG 权限策略"),
                stringValue(request, "securityLevel", "internal"),
                stringValue(request, "status", "active"));
        return getPolicy(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updatePolicy(Long id, Map<String, Object> request) {
        Map<String, Object> current = getPolicy(id);
        jdbcTemplate.update(
                "UPDATE ks_acl_policy SET policy_name = ?, security_level = ?, status = ?, " +
                        "acl_version = acl_version + 1, updated_at = ? WHERE id = ?",
                stringValue(request, "policyName", String.valueOf(current.get("policyName"))),
                stringValue(request, "securityLevel", String.valueOf(current.get("securityLevel"))),
                stringValue(request, "status", String.valueOf(current.get("status"))),
                LocalDateTime.now(),
                id);
        return getPolicy(id);
    }

    public List<Map<String, Object>> listBindings(Long policyId) {
        String sql = "SELECT b.id, b.policy_id, p.policy_name, b.principal_type, b.principal_id, b.action, b.effect, b.created_at " +
                "FROM ks_acl_binding b LEFT JOIN ks_acl_policy p ON p.id = b.policy_id";
        java.util.List<Object> args = new java.util.ArrayList<Object>();
        if (policyId != null) {
            sql += " WHERE b.policy_id = ?";
            args.add(policyId);
        }
        sql += " ORDER BY b.created_at DESC, b.id DESC";
        return jdbcTemplate.query(sql, knowledgeService.rowMapper(), args.toArray());
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createBinding(Map<String, Object> request) {
        Long policyId = longValue(request, "policyId", null);
        if (policyId == null) {
            throw new BusinessException("policyId 不能为空");
        }
        getPolicy(policyId);
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO ks_acl_binding(policy_id, principal_type, principal_id, action, effect) VALUES (?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                policyId,
                stringValue(request, "principalType", "department"),
                stringValue(request, "principalId", ""),
                stringValue(request, "action", "use_in_rag"),
                stringValue(request, "effect", "allow"));
        return getBinding(id);
    }

    public Map<String, Object> getBinding(Long id) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT b.id, b.policy_id, p.policy_name, b.principal_type, b.principal_id, b.action, b.effect, b.created_at " +
                            "FROM ks_acl_binding b LEFT JOIN ks_acl_policy p ON p.id = b.policy_id WHERE b.id = ?",
                    knowledgeService.rowMapper(), id);
        } catch (EmptyResultDataAccessException ex) {
            throw new BusinessException("RAG 权限绑定不存在");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteBinding(Long id) {
        jdbcTemplate.update("DELETE FROM ks_acl_binding WHERE id = ?", id);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updateChunkGovernance(Long chunkId, Map<String, Object> request) {
        Map<String, Object> current = getChunk(chunkId);
        Long aclPolicyId = longValue(request, "aclPolicyId", longFromObject(current.get("aclPolicyId")));
        if (aclPolicyId != null) {
            getPolicy(aclPolicyId);
        }
        jdbcTemplate.update(
                "UPDATE ks_chunk SET acl_policy_id = ?, security_level = ?, department_tags = ?, position_tags = ?, " +
                        "knowledge_status = ?, updated_at = ? WHERE id = ?",
                aclPolicyId,
                stringValue(request, "securityLevel", String.valueOf(current.get("securityLevel"))),
                stringValue(request, "departmentTags", stringOrEmpty(current.get("departmentTags"))),
                stringValue(request, "positionTags", stringOrEmpty(current.get("positionTags"))),
                stringValue(request, "knowledgeStatus", String.valueOf(current.get("knowledgeStatus"))),
                LocalDateTime.now(),
                chunkId);
        return getChunk(chunkId);
    }

    public Map<String, Object> getChunk(Long chunkId) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT c.id, c.source_type, c.source_id, c.source_version, c.wiki_page_id, c.wiki_page_version, " +
                            "COALESCE(p.title, d.name, c.chunk_summary) AS source_title, c.chunk_summary, c.acl_policy_id, " +
                            "ap.policy_name, c.security_level, c.department_tags, c.position_tags, c.knowledge_status, " +
                            "LEFT(c.chunk_text, 240) AS preview, c.created_at, c.updated_at " +
                            "FROM ks_chunk c " +
                            "LEFT JOIN ks_wiki_page p ON p.id = c.wiki_page_id " +
                            "LEFT JOIN ds_document d ON c.source_type = 'document' AND d.id = c.source_id " +
                            "LEFT JOIN ks_acl_policy ap ON ap.id = c.acl_policy_id WHERE c.id = ?",
                    knowledgeService.rowMapper(), chunkId);
        } catch (EmptyResultDataAccessException ex) {
            throw new BusinessException("RAG chunk 不存在");
        }
    }

    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("activeChunks", count("SELECT COUNT(1) FROM ks_chunk WHERE knowledge_status = 'active'"));
        result.put("policies", count("SELECT COUNT(1) FROM ks_acl_policy"));
        result.put("bindings", count("SELECT COUNT(1) FROM ks_acl_binding"));
        result.put("citations", count("SELECT COUNT(1) FROM ks_citation_log"));
        result.put("failedSyncJobs", count("SELECT COUNT(1) FROM ks_sync_job WHERE status = 'failed'"));
        return result;
    }

    private Long count(String sql) {
        return jdbcTemplate.queryForObject(sql, Long.class);
    }

    private String stringValue(Map<String, Object> request, String key, String fallback) {
        Object value = request == null ? null : request.get(key);
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            return fallback;
        }
        return String.valueOf(value).trim();
    }

    private Long longValue(Map<String, Object> request, String key, Long fallback) {
        Object value = request == null ? null : request.get(key);
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            return fallback;
        }
        return Long.valueOf(String.valueOf(value));
    }

    private Long longFromObject(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        return Long.valueOf(String.valueOf(value));
    }

    private String stringOrEmpty(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
