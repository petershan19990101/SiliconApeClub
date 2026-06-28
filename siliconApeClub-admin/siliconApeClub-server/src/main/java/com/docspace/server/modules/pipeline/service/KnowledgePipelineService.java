package com.docspace.server.modules.pipeline.service;

import com.docspace.server.common.enums.AuditAction;
import com.docspace.server.common.enums.DocumentStatus;
import com.docspace.server.common.enums.JobStatus;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.infrastructure.cache.CacheService;
import com.docspace.server.modules.audit.service.AuditTraceService;
import com.docspace.server.modules.document.service.DocumentSupportService;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.modules.notification.service.NotificationService;
import com.docspace.server.modules.pipeline.dto.DocumentToWikiRequest;
import com.docspace.server.modules.wiki.dto.WikiPageRequest;
import com.docspace.server.modules.wiki.service.WikiService;
import com.docspace.server.persistence.entity.DocumentEntity;
import com.docspace.server.persistence.mapper.DocumentMapper;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class KnowledgePipelineService {

    private final JdbcTemplate jdbcTemplate;
    private final JsonUtils jsonUtils;
    private final KnowledgeService knowledgeService;
    private final WikiService wikiService;
    private final DocumentMapper documentMapper;
    private final DocumentSupportService documentSupportService;
    private final AuditTraceService auditTraceService;
    private final NotificationService notificationService;
    private final CacheService cacheService;

    public List<Map<String, Object>> listJobs(String status, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        if (status != null && !status.trim().isEmpty()) {
            return jdbcTemplate.query(
                    "SELECT id, job_type, source_type, source_id, source_version, target_type, target_id, status, attempt_count, " +
                            "error_message, result_json, created_by, started_at, finished_at, created_at, updated_at " +
                            "FROM ks_pipeline_job WHERE status = ? ORDER BY created_at DESC LIMIT ?",
                    knowledgeService.rowMapper(), status, safeLimit);
        }
        return jdbcTemplate.query(
                "SELECT id, job_type, source_type, source_id, source_version, target_type, target_id, status, attempt_count, " +
                        "error_message, result_json, created_by, started_at, finished_at, created_at, updated_at " +
                        "FROM ks_pipeline_job ORDER BY created_at DESC LIMIT ?",
                knowledgeService.rowMapper(), safeLimit);
    }

    public Map<String, Object> getJob(Long id) {
        return jdbcTemplate.queryForObject(
                "SELECT id, job_type, source_type, source_id, source_version, target_type, target_id, status, attempt_count, " +
                        "error_message, result_json, created_by, started_at, finished_at, created_at, updated_at " +
                        "FROM ks_pipeline_job WHERE id = ?",
                knowledgeService.rowMapper(), id);
    }

    public Map<String, Object> documentToWiki(Long documentId, DocumentToWikiRequest request, SecurityUser currentUser) {
        DocumentToWikiRequest safeRequest = request == null ? new DocumentToWikiRequest() : request;
        DocumentEntity document = documentSupportService.getRequiredDocument(documentId);
        if (!JobStatus.SUCCESS.name().equals(document.getParseStatus())) {
            throw new BusinessException("文档尚未解析成功，不能生成 LLM Wiki");
        }
        if (document.getLatestParsedText() == null || document.getLatestParsedText().trim().isEmpty()) {
            throw new BusinessException("文档解析内容为空，不能生成 LLM Wiki");
        }

        Long jobId = createJob(document, currentUser);
        markDocumentRagRunning(document, currentUser);
        try {
            WikiPageRequest wikiRequest = buildWikiRequest(document, safeRequest);
            Long existingWikiPageId = findExistingWikiPageId(document);
            Map<String, Object> wikiPage = existingWikiPageId == null
                    ? wikiService.createPage(wikiRequest, currentUser)
                    : wikiService.updatePage(existingWikiPageId, wikiRequest, currentUser);
            Long wikiPageId = asLong(wikiPage.get("id"));
            jdbcTemplate.update(
                    "UPDATE ks_pipeline_job SET target_type = 'wiki_page', target_id = ?, updated_at = ? WHERE id = ?",
                    wikiPageId,
                    LocalDateTime.now(),
                    jobId);
            boolean publish = !Boolean.FALSE.equals(safeRequest.getPublish());
            if (publish) {
                wikiPage = wikiService.publish(wikiPageId, currentUser);
            }
            Map<String, Object> syncStatus = wikiService.syncStatus(wikiPageId);
            Map<String, Object> result = new LinkedHashMap<String, Object>();
            result.put("documentId", document.getId());
            result.put("documentVersion", document.getCurrentVersion());
            result.put("wikiPageId", wikiPageId);
            result.put("reusedWikiPage", existingWikiPageId != null);
            result.put("published", publish);
            result.put("wikiStatus", wikiPage.get("status"));
            result.put("wikiSyncStatus", wikiPage.get("syncStatus"));
            result.put("chunkCount", syncStatus.get("chunkCount"));
            result.put("indexStatus", syncStatus.get("indexStatus"));

            jdbcTemplate.update(
                    "UPDATE ks_pipeline_job SET target_type = 'wiki_page', target_id = ?, status = 'completed', " +
                            "result_json = ?, finished_at = ?, updated_at = ? WHERE id = ?",
                    wikiPageId,
                    jsonUtils.toJson(result),
                    LocalDateTime.now(),
                    LocalDateTime.now(),
                    jobId);
            if (publish) {
                markDocumentRagReady(document, currentUser);
            } else {
                markDocumentRagIdle(document);
            }
            documentSupportService.addAudit(document.getId(), document.getCurrentVersion(), AuditAction.PIPELINE_TO_WIKI, currentUser,
                    "解析产物已生成 LLM Wiki 页面 #" + wikiPageId);
            documentSupportService.publishEvent(AuditAction.PIPELINE_TO_WIKI, document, currentUser);
            auditTraceService.record(currentUser, "knowledge_pipeline.document_to_wiki", "document", document.getId(), "success", result);
            notificationService.createForUser(
                    currentUser == null ? null : currentUser.getId(),
                    "info",
                    "文档已生成 LLM Wiki",
                    document.getName() + " 已生成 Wiki 页面并同步 RAG 索引。",
                    result);
            return getJob(jobId);
        } catch (Exception ex) {
            Map<String, Object> metadata = new LinkedHashMap<String, Object>();
            metadata.put("documentId", documentId);
            metadata.put("error", ex.getMessage());
            markDocumentRagFailed(document, currentUser, ex.getMessage());
            jdbcTemplate.update(
                    "UPDATE ks_pipeline_job SET status = 'failed', error_message = ?, finished_at = ?, updated_at = ? WHERE id = ?",
                    ex.getMessage(),
                    LocalDateTime.now(),
                    LocalDateTime.now(),
                    jobId);
            auditTraceService.record(currentUser, "knowledge_pipeline.document_to_wiki", "document", documentId, "failed", metadata);
            notificationService.createForUser(
                    currentUser == null ? null : currentUser.getId(),
                    "high",
                    "文档生成 LLM Wiki 失败",
                    ex.getMessage(),
                    metadata);
            throw new BusinessException("文档生成 LLM Wiki 失败: " + ex.getMessage());
        }
    }

    private Long createJob(DocumentEntity document, SecurityUser currentUser) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO ks_pipeline_job(job_type, source_type, source_id, source_version, status, attempt_count, created_by, started_at, updated_at) " +
                        "VALUES ('document_to_wiki', 'document', ?, ?, 'running', 1, ?, ?, ?) RETURNING id",
                Long.class,
                document.getId(),
                document.getCurrentVersion(),
                currentUser == null ? null : currentUser.getId(),
                LocalDateTime.now(),
                LocalDateTime.now());
    }

    private Long findExistingWikiPageId(DocumentEntity document) {
        List<Long> ids = jdbcTemplate.queryForList(
                "SELECT j.target_id FROM ks_pipeline_job j " +
                        "JOIN ks_wiki_page p ON p.id = j.target_id AND p.deleted = 0 " +
                        "WHERE j.job_type = 'document_to_wiki' AND j.source_type = 'document' " +
                        "AND j.source_id = ? AND j.source_version = ? AND j.target_type = 'wiki_page' " +
                        "AND j.status IN ('completed', 'failed') AND j.target_id IS NOT NULL " +
                        "ORDER BY j.finished_at DESC, j.id DESC LIMIT 1",
                Long.class,
                document.getId(),
                document.getCurrentVersion());
        return ids.isEmpty() ? null : ids.get(0);
    }

    private WikiPageRequest buildWikiRequest(DocumentEntity document, DocumentToWikiRequest request) {
        WikiPageRequest wikiRequest = new WikiPageRequest();
        String title = request.getTitle() == null || request.getTitle().trim().isEmpty()
                ? document.getName()
                : request.getTitle().trim();
        String summary = request.getSummary() == null || request.getSummary().trim().isEmpty()
                ? summarize(document.getLatestParsedText())
                : request.getSummary().trim();
        Map<String, Object> metadata = new LinkedHashMap<String, Object>();
        metadata.put("sourceType", "admin_document");
        metadata.put("sourceDocumentId", document.getId());
        metadata.put("sourceDocumentVersion", document.getCurrentVersion());
        metadata.put("sourceFileName", document.getLatestSourceFile());
        metadata.put("parseEngine", document.getParseEngine());
        metadata.put("pipeline", "document_to_wiki");

        List<String> tags = request.getTags() == null ? jsonUtils.readList(document.getTagsJson(), String.class) : request.getTags();
        if (tags == null || tags.isEmpty()) {
            tags = new ArrayList<String>();
            tags.add("silicon-ape-club");
            tags.add("pipeline");
        }

        wikiRequest.setTitle(title);
        wikiRequest.setPageType("document");
        wikiRequest.setSummary(summary);
        wikiRequest.setContent(buildWikiContent(document, title));
        wikiRequest.setMetadata(metadata);
        wikiRequest.setTags(tags);
        wikiRequest.setDepartmentId(document.getDepartmentId());
        wikiRequest.setAclPolicyId(resolveAclPolicyId(document));
        return wikiRequest;
    }

    private Long resolveAclPolicyId(DocumentEntity document) {
        String policyName = "文档知识 ACL #" + document.getId() + " v" + document.getCurrentVersion();
        List<Long> existing = jdbcTemplate.queryForList(
                "SELECT id FROM ks_acl_policy WHERE policy_name = ? ORDER BY id DESC LIMIT 1",
                Long.class,
                policyName);
        Long policyId;
        if (existing.isEmpty()) {
            policyId = jdbcTemplate.queryForObject(
                    "INSERT INTO ks_acl_policy(policy_name, security_level, status) VALUES (?, 'internal', 'active') RETURNING id",
                    Long.class,
                    policyName);
        } else {
            policyId = existing.get(0);
            jdbcTemplate.update(
                    "UPDATE ks_acl_policy SET acl_version = acl_version + 1, status = 'active', updated_at = ? WHERE id = ?",
                    LocalDateTime.now(),
                    policyId);
        }

        jdbcTemplate.update("DELETE FROM ks_acl_binding WHERE policy_id = ?", policyId);
        jdbcTemplate.update(
                "INSERT INTO ks_acl_binding(policy_id, principal_type, principal_id, action, effect) VALUES (?, 'department', ?, 'use_in_rag', 'allow')",
                policyId,
                String.valueOf(document.getDepartmentId()));
        List<Map<String, Object>> permissions = jdbcTemplate.query(
                "SELECT user_id, permissions_json FROM ds_document_permission WHERE document_id = ?",
                knowledgeService.rowMapper(),
                document.getId());
        for (Map<String, Object> permission : permissions) {
            List<String> actions = jsonUtils.readList(String.valueOf(permission.get("permissionsJson")), String.class);
            if (actions.contains("view")) {
                jdbcTemplate.update(
                        "INSERT INTO ks_acl_binding(policy_id, principal_type, principal_id, action, effect) VALUES (?, 'user', ?, 'use_in_rag', 'allow')",
                        policyId,
                        String.valueOf(permission.get("userId")));
            }
        }
        return policyId;
    }

    private String buildWikiContent(DocumentEntity document, String title) {
        StringBuilder builder = new StringBuilder();
        builder.append("# ").append(title).append("\n\n");
        builder.append("> 来源：硅基猿猴俱乐部管理台文档 #").append(document.getId())
                .append(" / v").append(document.getCurrentVersion())
                .append(" / ").append(document.getLatestSourceFile() == null ? "未命名源文件" : document.getLatestSourceFile())
                .append("\n\n");
        builder.append(document.getLatestParsedText());
        return builder.toString();
    }

    private void markDocumentRagReady(DocumentEntity document, SecurityUser currentUser) {
        document.setRagStatus(JobStatus.SUCCESS.name());
        document.setRagFinishedAt(LocalDateTime.now());
        document.setRagLastRunBy(currentUser == null ? null : currentUser.getDisplayName());
        if (!DocumentStatus.PUBLISHED.name().equals(document.getStatus())) {
            document.setStatus(DocumentStatus.RAG_READY.name());
        }
        document.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(document);
        evictDashboardCache();
    }

    private void markDocumentRagRunning(DocumentEntity document, SecurityUser currentUser) {
        document.setRagStatus(JobStatus.RUNNING.name());
        document.setRagStartedAt(LocalDateTime.now());
        document.setRagFinishedAt(null);
        document.setRagErrorMessage(null);
        document.setRagAttemptCount(documentSupportService.optionalInteger(document.getRagAttemptCount()) + 1);
        document.setRagLastRunBy(currentUser == null ? null : currentUser.getDisplayName());
        document.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(document);
        evictDashboardCache();
    }

    private void markDocumentRagIdle(DocumentEntity document) {
        document.setRagStatus(JobStatus.IDLE.name());
        document.setRagStartedAt(null);
        document.setRagFinishedAt(null);
        document.setRagErrorMessage(null);
        document.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(document);
        evictDashboardCache();
    }

    private void markDocumentRagFailed(DocumentEntity document, SecurityUser currentUser, String errorMessage) {
        document.setRagStatus(JobStatus.FAILED.name());
        document.setRagFinishedAt(LocalDateTime.now());
        document.setRagErrorMessage(errorMessage);
        document.setRagLastRunBy(currentUser == null ? null : currentUser.getDisplayName());
        document.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(document);
        evictDashboardCache();
    }

    private void evictDashboardCache() {
        cacheService.evict("dashboard:stats");
        cacheService.evict("dashboard:activities:5");
        cacheService.evict("dashboard:activities:10");
    }

    private String summarize(String text) {
        if (text == null || text.trim().isEmpty()) {
            return "";
        }
        String safe = text.replaceAll("\\s+", " ").trim();
        return safe.length() <= 240 ? safe : safe.substring(0, 240);
    }

    private Long asLong(Object value) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        return value == null ? null : Long.parseLong(String.valueOf(value));
    }
}
