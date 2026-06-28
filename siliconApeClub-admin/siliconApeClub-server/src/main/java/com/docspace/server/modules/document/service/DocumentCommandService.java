package com.docspace.server.modules.document.service;

import com.docspace.server.common.enums.AuditAction;
import com.docspace.server.common.enums.DocumentStatus;
import com.docspace.server.common.enums.JobStatus;
import com.docspace.server.common.enums.UserRole;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.infrastructure.cache.CacheService;
import com.docspace.server.infrastructure.storage.StorageService;
import com.docspace.server.infrastructure.storage.StoredObject;
import com.docspace.server.modules.document.dto.AccessControlEntryDto;
import com.docspace.server.modules.document.dto.DocumentDto;
import com.docspace.server.modules.document.dto.RejectAuditRequest;
import com.docspace.server.modules.document.dto.SaveCorrectionRequest;
import com.docspace.server.modules.document.dto.StartParseRequest;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.modules.pipeline.dto.DocumentToWikiRequest;
import com.docspace.server.modules.pipeline.service.KnowledgePipelineService;
import com.docspace.server.persistence.entity.DocumentEntity;
import com.docspace.server.persistence.entity.DocumentVersionEntity;
import com.docspace.server.persistence.entity.FolderEntity;
import com.docspace.server.persistence.mapper.DocumentMapper;
import com.docspace.server.persistence.mapper.DocumentVersionMapper;
import com.docspace.server.persistence.mapper.FolderMapper;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class DocumentCommandService {

    private final DocumentMapper documentMapper;
    private final DocumentVersionMapper documentVersionMapper;
    private final FolderMapper folderMapper;
    private final DocumentSupportService documentSupportService;
    private final ParseEngineService parseEngineService;
    private final PermissionSupportService permissionSupportService;
    private final DocumentParseExecutionService documentParseExecutionService;
    private final StorageService storageService;
    private final JsonUtils jsonUtils;
    private final CacheService cacheService;
    private final KnowledgeService knowledgeService;
    private final KnowledgePipelineService knowledgePipelineService;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(rollbackFor = Exception.class)
    public List<DocumentDto> uploadDocuments(MultipartFile[] files, Long folderId, SecurityUser currentUser) {
        if (currentUser == null || currentUser.getDepartmentId() == null) {
            throw new BusinessException("当前用户未绑定部门，无法上传文档");
        }
        Long departmentId = currentUser.getDepartmentId();
        if (folderId != null) {
            FolderEntity folder = folderMapper.selectById(folderId);
            if (folder == null || (folder.getDeleted() != null && folder.getDeleted() == 1)) {
                throw new BusinessException("当前目录不存在: " + folderId);
            }
            departmentId = folder.getDepartmentId();
        }
        return uploadDocumentsWithDepartment(files, departmentId, folderId, currentUser);
    }

    @Transactional(rollbackFor = Exception.class)
    public List<DocumentDto> uploadDocuments(MultipartFile[] files, Long departmentId, Long folderId, SecurityUser currentUser) {
        return uploadDocumentsWithDepartment(files, departmentId, folderId, currentUser);
    }

    @Transactional(rollbackFor = Exception.class)
    public DocumentDto saveCorrection(Long id, SaveCorrectionRequest request, SecurityUser currentUser) {
        DocumentEntity document = documentSupportService.getRequiredDocument(id);
        documentSupportService.ensureEditable(document);
        LocalDateTime now = LocalDateTime.now();
        String parsedText = request.getLatestParsedText() == null ? "" : request.getLatestParsedText().trim();
        document.setName(request.getName());
        document.setDescription(request.getDescription());
        document.setTagsJson(jsonUtils.toJson(request.getTags()));
        document.setLatestParsedText(request.getLatestParsedText());
        document.setStatus(DocumentStatus.UPLOADED.name());
        document.setRagStatus(JobStatus.IDLE.name());
        document.setRagStartedAt(null);
        document.setRagFinishedAt(null);
        document.setRagAttemptCount(0);
        document.setRagErrorMessage(null);
        document.setRagLastRunBy(null);
        document.setParseErrorMessage(null);
        document.setParseLastRunBy(currentUser.getDisplayName());
        if (!parsedText.isEmpty()) {
            document.setParseStatus(JobStatus.SUCCESS.name());
            document.setParseFinishedAt(now);
            if (document.getParseStartedAt() == null) {
                document.setParseStartedAt(now);
            }
        } else {
            document.setParseStatus(JobStatus.IDLE.name());
            document.setParseStartedAt(null);
            document.setParseFinishedAt(null);
        }
        document.setUpdatedAt(now);
        documentMapper.updateById(document);

        DocumentVersionEntity versionEntity = documentSupportService.getCurrentVersionEntity(document.getId(), document.getCurrentVersion());
        if (versionEntity != null) {
            versionEntity.setParsedContent(request.getLatestParsedText());
            versionEntity.setAuthor(currentUser.getDisplayName());
            versionEntity.setSummary("已保存人工校正内容");
            versionEntity.setSummary(parsedText.isEmpty() ? "已清空解析内容" : "已保存手动录入的解析内容");
            versionEntity.setCreatedAt(now);
            documentVersionMapper.updateById(versionEntity);
        }
        documentSupportService.addAudit(document.getId(), document.getCurrentVersion(), AuditAction.SAVE, currentUser, "保存人工校正内容");
        return documentSupportService.toDocumentDto(documentSupportService.getRequiredDocument(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public DocumentDto startParse(Long id, StartParseRequest request, SecurityUser currentUser) {
        DocumentEntity document = documentSupportService.getRequiredDocument(id);
        documentSupportService.ensureEditable(document);

        StartParseRequest safeRequest = request == null ? new StartParseRequest() : request;
        String sourceFileName = document.getLatestSourceFile();
        ParseEngineService.EngineSelection engineSelection = parseEngineService.resolveEngineForFile(sourceFileName, safeRequest.getEngine());
        LocalDateTime now = LocalDateTime.now();

        document.setStatus(DocumentStatus.PARSING.name());
        document.setParseStatus(JobStatus.RUNNING.name());
        document.setParseStartedAt(now);
        document.setParseFinishedAt(null);
        document.setParseAttemptCount(documentSupportService.optionalInteger(document.getParseAttemptCount()) + 1);
        document.setParseEngine(engineSelection.getEngineName());
        document.setParseLastRunBy(currentUser.getDisplayName());
        document.setParseErrorMessage(null);
        document.setRagStatus(JobStatus.IDLE.name());
        document.setRagStartedAt(null);
        document.setRagFinishedAt(null);
        document.setRagAttemptCount(0);
        document.setRagErrorMessage(null);
        document.setRagLastRunBy(null);
        document.setRejectedReason(null);
        document.setUpdatedAt(now);
        documentMapper.updateById(document);

        int nextVersion = documentSupportService.optionalInteger(document.getCurrentVersion()) + 1;
        DocumentParseExecutionService.ParseExecutionResult parseResult = documentParseExecutionService.execute(
                document.getId(),
                document.getName(),
                sourceFileName,
                document.getStorageBucket(),
                document.getStorageObject(),
                nextVersion,
                engineSelection);

        LocalDateTime finishedAt = LocalDateTime.now();
        document.setCurrentVersion(nextVersion);
        document.setStatus(DocumentStatus.UPLOADED.name());
        document.setLatestSourceFile(sourceFileName);
        document.setLatestParsedText(parseResult.getMarkdownContent());
        document.setParseStatus(JobStatus.SUCCESS.name());
        document.setParseFinishedAt(finishedAt);
        document.setParseEngine(parseResult.getEngineName());
        document.setParseErrorMessage(null);
        document.setRagStatus(JobStatus.IDLE.name());
        document.setRagStartedAt(null);
        document.setRagFinishedAt(null);
        document.setRagAttemptCount(0);
        document.setRagErrorMessage(null);
        document.setRagLastRunBy(null);
        document.setUpdatedAt(finishedAt);
        documentMapper.updateById(document);

        DocumentVersionEntity versionEntity = new DocumentVersionEntity();
        versionEntity.setDocumentId(document.getId());
        versionEntity.setVersion(nextVersion);
        versionEntity.setSourceFileName(sourceFileName);
        versionEntity.setParsedContent(parseResult.getMarkdownContent());
        versionEntity.setEngine(parseResult.getEngineName());
        versionEntity.setAuthor(currentUser.getDisplayName());
        versionEntity.setStatus("draft");
        versionEntity.setSummary("重新解析完成，等待生成 LLM Wiki 并同步 RAG");
        versionEntity.setCreatedAt(finishedAt);
        documentVersionMapper.insert(versionEntity);

        documentSupportService.addAudit(document.getId(), nextVersion, AuditAction.REPARSE, currentUser, "使用 " + parseResult.getEngineName() + " 重新解析");
        documentSupportService.publishEvent(AuditAction.REPARSE, document, currentUser);
        evictDashboardCache();
        return documentSupportService.toDocumentDto(documentSupportService.getRequiredDocument(document.getId()));
    }

    @Transactional(rollbackFor = Exception.class)
    public DocumentDto startRagSync(Long id, SecurityUser currentUser) {
        DocumentEntity document = documentSupportService.getRequiredDocument(id);
        if (DocumentStatus.LOCKED.name().equals(document.getStatus()) || DocumentStatus.PENDING_AUDIT.name().equals(document.getStatus())) {
            throw new BusinessException("当前状态不允许重新推送 RAG");
        }
        if (!JobStatus.SUCCESS.name().equals(document.getParseStatus())) {
            throw new BusinessException("请先完成解析后再进行 RAG 同步");
        }
        document.setRagStatus(JobStatus.RUNNING.name());
        document.setRagStartedAt(LocalDateTime.now());
        document.setRagAttemptCount(documentSupportService.optionalInteger(document.getRagAttemptCount()) + 1);
        document.setRagLastRunBy(currentUser.getDisplayName());
        documentMapper.updateById(document);

        knowledgeService.syncDocument(document.getId(), currentUser);

        document.setRagStatus(JobStatus.SUCCESS.name());
        document.setRagFinishedAt(LocalDateTime.now());
        if (!DocumentStatus.REJECTED.name().equals(document.getStatus())) {
            document.setStatus(DocumentStatus.RAG_READY.name());
        }
        document.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(document);
        documentSupportService.addAudit(document.getId(), document.getCurrentVersion(), AuditAction.RAG_SYNC, currentUser, "重新同步到知识库");
        documentSupportService.publishEvent(AuditAction.RAG_SYNC, document, currentUser);
        evictDashboardCache();
        return documentSupportService.toDocumentDto(documentSupportService.getRequiredDocument(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public DocumentDto requestAudit(Long id, SecurityUser currentUser) {
        DocumentEntity document = documentSupportService.getRequiredDocument(id);
        if (!(DocumentStatus.RAG_READY.name().equals(document.getStatus()) || DocumentStatus.REJECTED.name().equals(document.getStatus()))) {
            throw new BusinessException("仅 RAG 就绪或已驳回文档可提交审核");
        }
        document.setStatus(DocumentStatus.PENDING_AUDIT.name());
        document.setRejectedReason(null);
        document.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(document);
        documentSupportService.addAudit(document.getId(), document.getCurrentVersion(), AuditAction.SUBMIT, currentUser, "提交审核");
        documentSupportService.publishEvent(AuditAction.SUBMIT, document, currentUser);
        evictDashboardCache();
        return documentSupportService.toDocumentDto(documentSupportService.getRequiredDocument(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public DocumentDto rejectAudit(Long id, RejectAuditRequest request, SecurityUser currentUser) {
        DocumentEntity document = documentSupportService.getRequiredDocument(id);
        if (!DocumentStatus.PENDING_AUDIT.name().equals(document.getStatus())) {
            throw new BusinessException("当前文档不在待审核状态");
        }
        document.setStatus(DocumentStatus.REJECTED.name());
        document.setRejectedReason(request.getReason());
        document.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(document);
        documentSupportService.addAudit(document.getId(), document.getCurrentVersion(), AuditAction.REJECT, currentUser, request.getReason());
        documentSupportService.publishEvent(AuditAction.REJECT, document, currentUser);
        evictDashboardCache();
        return documentSupportService.toDocumentDto(documentSupportService.getRequiredDocument(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public DocumentDto publish(Long id, SecurityUser currentUser) {
        DocumentEntity document = documentSupportService.getRequiredDocument(id);
        if (!DocumentStatus.PENDING_AUDIT.name().equals(document.getStatus())) {
            throw new BusinessException("只有待审核文档才能发布");
        }
        if (document.getRevisionDraft() != null && document.getRevisionDraft() == 1 && document.getLiveDocumentId() != null) {
            DocumentEntity source = documentSupportService.getRequiredDocument(document.getLiveDocumentId());
            source.setStatus(DocumentStatus.LOCKED.name());
            source.setLockedFromStatus(DocumentStatus.PUBLISHED.name());
            source.setUpdatedAt(LocalDateTime.now());
            documentMapper.updateById(source);
            documentSupportService.addAudit(source.getId(), documentSupportService.optionalInteger(source.getLiveVersion()), AuditAction.LOCK, currentUser, "被新修订版本替换");
        }
        document.setName(document.getRevisionDraft() != null && document.getRevisionDraft() == 1
                ? document.getName().replace("（修订草稿）", "").trim() : document.getName());
        document.setStatus(DocumentStatus.PUBLISHED.name());
        document.setLiveVersion(document.getCurrentVersion());
        document.setRevisionDraft(0);
        document.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(document);

        DocumentVersionEntity currentVersion = documentSupportService.getCurrentVersionEntity(document.getId(), document.getCurrentVersion());
        if (currentVersion != null) {
            currentVersion.setStatus("published");
            documentVersionMapper.updateById(currentVersion);
        }
        documentSupportService.addAudit(document.getId(), document.getCurrentVersion(), AuditAction.PUBLISH, currentUser, "发布到知识库");
        ensureWikiPipelineForPublishedDocument(document, currentUser);
        documentSupportService.publishEvent(AuditAction.PUBLISH, document, currentUser);
        evictDashboardCache();
        return documentSupportService.toDocumentDto(documentSupportService.getRequiredDocument(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public DocumentDto createRevision(Long id, SecurityUser currentUser) {
        DocumentEntity source = documentSupportService.getRequiredDocument(id);
        if (!DocumentStatus.PUBLISHED.name().equals(source.getStatus())) {
            throw new BusinessException("只有已发布文档可创建修订草稿");
        }
        DocumentEntity existingDraft = documentMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<DocumentEntity>()
                .eq(DocumentEntity::getDeleted, 0)
                .eq(DocumentEntity::getLiveDocumentId, id)
                .eq(DocumentEntity::getRevisionDraft, 1)
                .last("limit 1"));
        if (existingDraft != null) {
            return documentSupportService.toDocumentDto(existingDraft);
        }
        DocumentEntity draft = new DocumentEntity();
        draft.setName(source.getName() + "（修订草稿）");
        draft.setDescription(source.getDescription());
        draft.setTagsJson(source.getTagsJson());
        draft.setCurrentVersion(documentSupportService.optionalInteger(source.getCurrentVersion()) + 1);
        draft.setStatus(DocumentStatus.RAG_READY.name());
        draft.setDepartmentId(source.getDepartmentId());
        draft.setFolderId(source.getFolderId());
        draft.setLatestSourceFile(source.getLatestSourceFile());
        draft.setLatestParsedText(source.getLatestParsedText());
        draft.setParseStatus(JobStatus.SUCCESS.name());
        draft.setParseFinishedAt(LocalDateTime.now());
        draft.setParseAttemptCount(documentSupportService.optionalInteger(source.getParseAttemptCount()));
        draft.setParseEngine(source.getParseEngine());
        draft.setParseLastRunBy(currentUser.getDisplayName());
        draft.setRagStatus(JobStatus.SUCCESS.name());
        draft.setRagFinishedAt(LocalDateTime.now());
        draft.setRagAttemptCount(documentSupportService.optionalInteger(source.getRagAttemptCount()));
        draft.setRagLastRunBy(currentUser.getDisplayName());
        draft.setRevisionSourceDocumentId(source.getId());
        draft.setRevisionSourceVersion(documentSupportService.optionalInteger(source.getLiveVersion()) == 0 ? source.getCurrentVersion() : source.getLiveVersion());
        draft.setLiveDocumentId(source.getId());
        draft.setRevisionDraft(1);
        draft.setStorageBucket(source.getStorageBucket());
        draft.setStorageObject(source.getStorageObject());
        draft.setCreatedBy(currentUser.getId());
        draft.setDeleted(0);
        draft.setCreatedAt(LocalDateTime.now());
        draft.setUpdatedAt(LocalDateTime.now());
        documentMapper.insert(draft);

        DocumentVersionEntity versionEntity = new DocumentVersionEntity();
        versionEntity.setDocumentId(draft.getId());
        versionEntity.setVersion(draft.getCurrentVersion());
        versionEntity.setSourceFileName(draft.getLatestSourceFile());
        versionEntity.setParsedContent(draft.getLatestParsedText());
        versionEntity.setEngine(draft.getParseEngine());
        versionEntity.setAuthor(currentUser.getDisplayName());
        versionEntity.setStatus("draft");
        versionEntity.setSummary("基于已发布版本创建修订草稿");
        versionEntity.setCreatedAt(LocalDateTime.now());
        documentVersionMapper.insert(versionEntity);

        permissionSupportService.copyDocumentPermissions(source.getId(), draft.getId());
        documentSupportService.addAudit(draft.getId(), draft.getCurrentVersion(), AuditAction.CREATE_REVISION, currentUser, "创建修订草稿");
        documentSupportService.addAudit(source.getId(), documentSupportService.optionalInteger(source.getLiveVersion()), AuditAction.CREATE_REVISION, currentUser, "创建修订草稿 " + draft.getName());
        documentSupportService.publishEvent(AuditAction.CREATE_REVISION, draft, currentUser);
        evictDashboardCache();
        return documentSupportService.toDocumentDto(draft);
    }

    @Transactional(rollbackFor = Exception.class)
    public DocumentDto lock(Long id, SecurityUser currentUser) {
        DocumentEntity document = documentSupportService.getRequiredDocument(id);
        if (!DocumentStatus.LOCKED.name().equals(document.getStatus())) {
            document.setLockedFromStatus(document.getStatus());
            document.setStatus(DocumentStatus.LOCKED.name());
            document.setUpdatedAt(LocalDateTime.now());
            documentMapper.updateById(document);
            documentSupportService.addAudit(document.getId(), document.getCurrentVersion(), AuditAction.LOCK, currentUser, "锁定文档");
        }
        return documentSupportService.toDocumentDto(documentSupportService.getRequiredDocument(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public DocumentDto unlock(Long id, SecurityUser currentUser) {
        DocumentEntity document = documentSupportService.getRequiredDocument(id);
        if (DocumentStatus.LOCKED.name().equals(document.getStatus())) {
            document.setStatus(document.getLockedFromStatus() == null ? DocumentStatus.RAG_READY.name() : document.getLockedFromStatus());
            document.setLockedFromStatus(null);
            document.setUpdatedAt(LocalDateTime.now());
            documentMapper.updateById(document);
            documentSupportService.addAudit(document.getId(), document.getCurrentVersion(), AuditAction.UNLOCK, currentUser, "解除锁定");
        }
        return documentSupportService.toDocumentDto(documentSupportService.getRequiredDocument(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public void updatePermissions(Long id, List<AccessControlEntryDto> accessControl) {
        permissionSupportService.replaceDocumentPermissions(id, accessControl);
    }

    @Transactional(rollbackFor = Exception.class)
    public void batchDelete(List<Long> ids, SecurityUser currentUser) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        List<DocumentEntity> documents = documentMapper.selectBatchIds(ids);
        for (DocumentEntity document : documents) {
            permissionSupportService.ensureCanDeleteDocument(document.getId(), currentUser);
            ensureDocumentDeletionAllowed(document, currentUser);
            cleanupDocumentKnowledge(document, currentUser);
            document.setDeleted(1);
            document.setUpdatedAt(LocalDateTime.now());
            documentMapper.updateById(document);
            documentSupportService.addAudit(document.getId(), document.getCurrentVersion(), AuditAction.DELETE, currentUser, "批量删除文档，并清理关联 Wiki/RAG");
        }
        evictDashboardCache();
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteDocument(Long id, SecurityUser currentUser) {
        permissionSupportService.ensureCanDeleteDocument(id, currentUser);
        DocumentEntity document = documentSupportService.getRequiredDocument(id);
        ensureDocumentDeletionAllowed(document, currentUser);
        cleanupDocumentKnowledge(document, currentUser);
        document.setDeleted(1);
        document.setUpdatedAt(LocalDateTime.now());
        documentMapper.updateById(document);
        documentSupportService.addAudit(document.getId(), document.getCurrentVersion(), AuditAction.DELETE, currentUser, "删除文档，并清理关联 Wiki/RAG");
        evictDashboardCache();
    }

    private void ensureDocumentDeletionAllowed(DocumentEntity document, SecurityUser currentUser) {
        if (DocumentStatus.PENDING_AUDIT.name().equals(document.getStatus())) {
            throw new BusinessException("待审核文档请先驳回后再删除: " + document.getName());
        }
        boolean publishedOrLocked = DocumentStatus.PUBLISHED.name().equals(document.getStatus())
                || DocumentStatus.LOCKED.name().equals(document.getStatus());
        if (publishedOrLocked && (currentUser == null || currentUser.getRole() != UserRole.ADMIN)) {
            throw new BusinessException("已发布或锁定文档仅管理员可删除: " + document.getName());
        }
    }

    private void cleanupDocumentKnowledge(DocumentEntity document, SecurityUser currentUser) {
        LocalDateTime now = LocalDateTime.now();
        List<Long> wikiPageIds = findDocumentWikiPageIds(document);
        int wikiPageCount = 0;
        int wikiVersionCount = 0;
        int chunkCount = 0;
        int indexRecordCount = 0;

        for (Long wikiPageId : wikiPageIds) {
            wikiPageCount += jdbcTemplate.update(
                    "UPDATE ks_wiki_page SET content = '', summary = '', deleted = 1, status = 'deleted', " +
                            "sync_status = 'deleted', health_status = 'unknown', updated_at = ? WHERE id = ?",
                    now,
                    wikiPageId);
            wikiVersionCount += jdbcTemplate.update(
                    "UPDATE ks_wiki_page_version SET content = '', status = 'deleted', summary = ? WHERE page_id = ?",
                    "源文档已删除，版本内容已清空",
                    wikiPageId);
            jdbcTemplate.update("DELETE FROM ks_wiki_relation WHERE source_page_id = ? OR target_page_id = ?", wikiPageId, wikiPageId);
            jdbcTemplate.update("DELETE FROM ks_position_package_item WHERE item_type = 'wiki_page' AND item_id = ?", wikiPageId);
            jdbcTemplate.update(
                    "UPDATE ks_knowledge_object SET content = '', status = 'deleted', updated_at = ? WHERE page_id = ?",
                    now,
                    wikiPageId);
            chunkCount += jdbcTemplate.update(
                    "UPDATE ks_chunk SET knowledge_status = 'deleted', chunk_text = '', chunk_summary = '', embedding = NULL, updated_at = ? " +
                            "WHERE wiki_page_id = ?",
                    now,
                    wikiPageId);
            indexRecordCount += jdbcTemplate.update(
                    "UPDATE ks_index_record SET index_status = 'deleted', index_error = ?, updated_at = ? WHERE wiki_page_id = ?",
                    "源文档已删除，索引已清空",
                    now,
                    wikiPageId);
            disableDocumentAclPolicy(wikiPageId, now);
        }

        chunkCount += jdbcTemplate.update(
                "UPDATE ks_chunk SET knowledge_status = 'deleted', chunk_text = '', chunk_summary = '', embedding = NULL, updated_at = ? " +
                        "WHERE source_type = 'document' AND source_id = ?",
                now,
                document.getId());
        indexRecordCount += jdbcTemplate.update(
                "UPDATE ks_index_record SET index_status = 'deleted', index_error = ?, updated_at = ? " +
                        "WHERE source_type = 'document' AND source_id = ?",
                "源文档已删除，索引已清空",
                now,
                document.getId());

        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("documentId", document.getId());
        result.put("documentVersion", document.getCurrentVersion());
        result.put("wikiPageIds", wikiPageIds);
        result.put("wikiPageCount", wikiPageCount);
        result.put("wikiVersionCount", wikiVersionCount);
        result.put("chunkCount", chunkCount);
        result.put("indexRecordCount", indexRecordCount);
        jdbcTemplate.update(
                "INSERT INTO ks_pipeline_job(job_type, source_type, source_id, source_version, target_type, status, attempt_count, result_json, created_by, started_at, finished_at, updated_at) " +
                        "VALUES ('document_knowledge_delete', 'document', ?, ?, 'wiki_page', 'completed', 1, ?, ?, ?, ?, ?)",
                document.getId(),
                document.getCurrentVersion(),
                jsonUtils.toJson(result),
                currentUser == null ? null : currentUser.getId(),
                now,
                now,
                now);
    }

    private List<Long> findDocumentWikiPageIds(DocumentEntity document) {
        List<Long> wikiPageIds = new ArrayList<Long>();
        wikiPageIds.addAll(jdbcTemplate.queryForList(
                "SELECT DISTINCT target_id FROM ks_pipeline_job " +
                        "WHERE job_type = 'document_to_wiki' AND source_type = 'document' AND source_id = ? " +
                        "AND target_type = 'wiki_page' AND target_id IS NOT NULL",
                Long.class,
                document.getId()));
        List<Long> metadataIds = jdbcTemplate.queryForList(
                "SELECT id FROM ks_wiki_page WHERE page_type = 'document' AND metadata_json LIKE ?",
                Long.class,
                "%\"sourceDocumentId\":" + document.getId() + "%");
        for (Long id : metadataIds) {
            if (!wikiPageIds.contains(id)) {
                wikiPageIds.add(id);
            }
        }
        if (document.getName() != null && !document.getName().trim().isEmpty()) {
            List<Long> titleIds = jdbcTemplate.queryForList(
                    "SELECT id FROM ks_wiki_page WHERE page_type = 'document' AND title = ?",
                    Long.class,
                    document.getName().trim());
            for (Long id : titleIds) {
                if (!wikiPageIds.contains(id)) {
                    wikiPageIds.add(id);
                }
            }
        }
        return wikiPageIds;
    }

    private void disableDocumentAclPolicy(Long wikiPageId, LocalDateTime now) {
        List<Map<String, Object>> policies = jdbcTemplate.query(
                "SELECT a.id, a.policy_name FROM ks_wiki_page p JOIN ks_acl_policy a ON a.id = p.acl_policy_id WHERE p.id = ?",
                knowledgeService.rowMapper(),
                wikiPageId);
        for (Map<String, Object> policy : policies) {
            String policyName = String.valueOf(policy.get("policyName"));
            if (!policyName.startsWith("文档知识 ACL #")) {
                continue;
            }
            Long policyId = ((Number) policy.get("id")).longValue();
            jdbcTemplate.update("DELETE FROM ks_acl_binding WHERE policy_id = ?", policyId);
            jdbcTemplate.update("UPDATE ks_acl_policy SET status = 'disabled', updated_at = ? WHERE id = ?", now, policyId);
        }
    }

    private List<DocumentDto> uploadDocumentsWithDepartment(MultipartFile[] files,
                                                            Long departmentId,
                                                            Long folderId,
                                                            SecurityUser currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new BusinessException("当前登录状态无效，无法上传文档");
        }
        if (departmentId == null) {
            throw new BusinessException("未指定部门，无法上传文档");
        }
        if (folderId != null) {
            FolderEntity folder = folderMapper.selectById(folderId);
            if (folder == null || (folder.getDeleted() != null && folder.getDeleted() == 1)) {
                throw new BusinessException("当前目录不存在: " + folderId);
            }
            if (!departmentId.equals(folder.getDepartmentId())) {
                throw new BusinessException("不能上传到其他部门目录");
            }
        }

        List<DocumentDto> result = new java.util.ArrayList<DocumentDto>();
        for (MultipartFile file : files) {
            result.add(uploadSingleDocument(file, departmentId, folderId, currentUser));
        }
        evictDashboardCache();
        return result;
    }

    private DocumentDto uploadSingleDocument(MultipartFile file,
                                             Long departmentId,
                                             Long folderId,
                                             SecurityUser currentUser) {
        StoredObject storedObject = storageService.store(file, "documents/" + LocalDate.now().toString());
        LocalDateTime now = LocalDateTime.now();
        String sourceFileName = file.getOriginalFilename();
        String documentName = documentSupportService.trimFileName(sourceFileName);
        boolean canParse = parseEngineService.hasEnabledEngineForFile(sourceFileName);

        DocumentEntity document = new DocumentEntity();
        document.setName(documentName);
        document.setDescription("由 " + currentUser.getDisplayName() + " 上传的原始文档");
        document.setTagsJson(jsonUtils.toJson(Collections.singletonList("待分类")));
        document.setCurrentVersion(1);
        document.setStatus(canParse ? DocumentStatus.PARSING.name() : DocumentStatus.UPLOADED.name());
        document.setDepartmentId(departmentId);
        document.setFolderId(folderId);
        document.setLatestSourceFile(sourceFileName);
        document.setLatestParsedText("");
        document.setParseStatus(canParse ? JobStatus.RUNNING.name() : JobStatus.IDLE.name());
        document.setParseStartedAt(canParse ? now : null);
        document.setParseFinishedAt(null);
        document.setParseAttemptCount(canParse ? 1 : 0);
        document.setParseEngine(null);
        document.setParseLastRunBy(canParse ? currentUser.getDisplayName() : null);
        document.setParseErrorMessage(null);
        document.setRagStatus(JobStatus.IDLE.name());
        document.setRagStartedAt(null);
        document.setRagFinishedAt(null);
        document.setRagAttemptCount(0);
        document.setRagErrorMessage(null);
        document.setRagLastRunBy(null);
        document.setRevisionDraft(0);
        document.setStorageBucket(storedObject.getBucket());
        document.setStorageObject(storedObject.getObjectName());
        document.setCreatedBy(currentUser.getId());
        document.setDeleted(0);
        document.setCreatedAt(now);
        document.setUpdatedAt(now);
        documentMapper.insert(document);

        String parsedContent = "";
        String parseEngineName = null;
        if (canParse) {
            ParseEngineService.EngineSelection engineSelection = parseEngineService.resolveDefaultEngineForFile(sourceFileName);
            DocumentParseExecutionService.ParseExecutionResult parseResult = documentParseExecutionService.execute(
                    document.getId(),
                    documentName,
                    sourceFileName,
                    storedObject.getBucket(),
                    storedObject.getObjectName(),
                    1,
                    engineSelection);
            parsedContent = parseResult.getMarkdownContent();
            parseEngineName = parseResult.getEngineName();

            document.setStatus(DocumentStatus.UPLOADED.name());
            document.setLatestParsedText(parsedContent);
            document.setParseStatus(JobStatus.SUCCESS.name());
            document.setParseFinishedAt(LocalDateTime.now());
            document.setParseEngine(parseEngineName);
            document.setParseErrorMessage(null);
            document.setUpdatedAt(LocalDateTime.now());
            documentMapper.updateById(document);
        }

        DocumentVersionEntity versionEntity = new DocumentVersionEntity();
        versionEntity.setDocumentId(document.getId());
        versionEntity.setVersion(1);
        versionEntity.setSourceFileName(sourceFileName);
        versionEntity.setParsedContent(parsedContent);
        versionEntity.setEngine(parseEngineName);
        versionEntity.setAuthor(currentUser.getDisplayName());
        versionEntity.setStatus("draft");
        versionEntity.setSummary(canParse ? "上传后自动解析完成，等待生成 LLM Wiki 并同步 RAG" : "上传成功，当前文件类型未配置解析引擎");
        versionEntity.setCreatedAt(LocalDateTime.now());
        documentVersionMapper.insert(versionEntity);

        documentSupportService.addAudit(document.getId(), 1, AuditAction.UPLOAD, currentUser, "上传并创建原始文档");
        if (canParse) {
            documentSupportService.addAudit(document.getId(), 1, AuditAction.PARSE, currentUser, "上传后自动使用 " + parseEngineName + " 完成解析");
        }
        permissionSupportService.seedDefaultDocumentPermissions(document.getId(), departmentId, currentUser.getId());
        documentSupportService.publishEvent(AuditAction.UPLOAD, document, currentUser);
        return documentSupportService.toDocumentDto(documentSupportService.getRequiredDocument(document.getId()));
    }

    private void evictDashboardCache() {
        cacheService.evict("dashboard:stats");
        cacheService.evict("dashboard:activities:5");
        cacheService.evict("dashboard:activities:10");
    }

    private void ensureWikiPipelineForPublishedDocument(DocumentEntity document, SecurityUser currentUser) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM ks_pipeline_job " +
                        "WHERE job_type = 'document_to_wiki' AND source_type = 'document' " +
                        "AND source_id = ? AND source_version = ? AND target_type = 'wiki_page' " +
                        "AND status = 'completed' AND target_id IS NOT NULL",
                Integer.class,
                document.getId(),
                document.getCurrentVersion());
        if (count != null && count > 0) {
            return;
        }
        DocumentToWikiRequest request = new DocumentToWikiRequest();
        request.setPublish(true);
        knowledgePipelineService.documentToWiki(document.getId(), request, currentUser);
    }
}
