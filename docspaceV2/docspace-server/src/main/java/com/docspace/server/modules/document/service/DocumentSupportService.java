/**
 * 文档支撑服务，负责 DTO 转换、审计写入和公共辅助逻辑复用。
 */
package com.docspace.server.modules.document.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.docspace.server.common.enums.AuditAction;
import com.docspace.server.common.enums.DocumentStatus;
import com.docspace.server.common.enums.JobStatus;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.infrastructure.messaging.DocumentLifecycleEvent;
import com.docspace.server.infrastructure.messaging.DomainEventPublisher;
import com.docspace.server.modules.document.dto.ActivityItemDto;
import com.docspace.server.modules.document.dto.AuditRecordDto;
import com.docspace.server.modules.document.dto.DocumentDto;
import com.docspace.server.modules.document.dto.DocumentJobDto;
import com.docspace.server.modules.document.dto.DocumentVersionDto;
import com.docspace.server.modules.document.dto.RevisionSourceDto;
import com.docspace.server.modules.document.dto.SearchResultDto;
import com.docspace.server.modules.user.service.UserQueryService;
import com.docspace.server.modules.user.service.UserSummaryDto;
import com.docspace.server.persistence.entity.DepartmentEntity;
import com.docspace.server.persistence.entity.DocumentAuditEntity;
import com.docspace.server.persistence.entity.DocumentEntity;
import com.docspace.server.persistence.entity.DocumentVersionEntity;
import com.docspace.server.persistence.entity.FolderEntity;
import com.docspace.server.persistence.mapper.DepartmentMapper;
import com.docspace.server.persistence.mapper.DocumentAuditMapper;
import com.docspace.server.persistence.mapper.DocumentMapper;
import com.docspace.server.persistence.mapper.DocumentVersionMapper;
import com.docspace.server.persistence.mapper.FolderMapper;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DocumentSupportService {

    private final DocumentMapper documentMapper;
    private final DocumentVersionMapper documentVersionMapper;
    private final DocumentAuditMapper documentAuditMapper;
    private final FolderMapper folderMapper;
    private final DepartmentMapper departmentMapper;
    private final PermissionSupportService permissionSupportService;
    private final UserQueryService userQueryService;
    private final JsonUtils jsonUtils;
    private final DomainEventPublisher domainEventPublisher;

    /**
     * 按 ID 获取文档，不存在时直接抛出业务异常。
     */
    /** 按 ID 获取文档，不存在时抛出业务异常。 */
    public DocumentEntity getRequiredDocument(Long id) {
        DocumentEntity entity = documentMapper.selectById(id);
        if (entity == null || entity.getDeleted() == null || entity.getDeleted() == 1) {
            throw new BusinessException("文档不存在: " + id);
        }
        return entity;
    }

    /**
     * 校验当前文档是否允许继续编辑类操作。
     */
    /** 校验当前文档是否允许继续编辑类操作。 */
    public void ensureEditable(DocumentEntity document) {
        if (DocumentStatus.LOCKED.name().equals(document.getStatus())
                || DocumentStatus.PUBLISHED.name().equals(document.getStatus())
                || DocumentStatus.PENDING_AUDIT.name().equals(document.getStatus())) {
            throw new BusinessException("当前状态不允许修改文档");
        }
    }

    /**
     * 查询当前工作版本对应的版本快照。
     */
    /** 查询当前工作版本对应的版本快照。 */
    public DocumentVersionEntity getCurrentVersionEntity(Long documentId, Integer version) {
        return documentVersionMapper.selectOne(new LambdaQueryWrapper<DocumentVersionEntity>()
                .eq(DocumentVersionEntity::getDocumentId, documentId)
                .eq(DocumentVersionEntity::getVersion, version)
                .last("limit 1"));
    }

    /**
     * 写入审计日志，统一记录生命周期关键动作。
     */
    /** 写入审计日志，统一记录生命周期关键动作。 */
    public void addAudit(Long documentId, Integer version, AuditAction action, SecurityUser currentUser, String comment) {
        DocumentAuditEntity audit = new DocumentAuditEntity();
        audit.setDocumentId(documentId);
        audit.setVersion(version);
        audit.setAction(action.name());
        audit.setOperatorId(currentUser.getId());
        audit.setOperatorName(currentUser.getDisplayName());
        audit.setComment(comment);
        audit.setCreatedAt(LocalDateTime.now());
        documentAuditMapper.insert(audit);
    }

    /**
     * 发布文档生命周期事件，供 RocketMQ 或兜底实现消费。
     */
    /** 发布文档生命周期事件，供 RocketMQ 或兜底实现消费。 */
    public void publishEvent(AuditAction action, DocumentEntity document, SecurityUser currentUser) {
        domainEventPublisher.publish(DocumentLifecycleEvent.builder()
                .action(action.name())
                .documentId(document.getId())
                .documentStatus(document.getStatus())
                .operatorId(currentUser.getId())
                .occurredAt(LocalDateTime.now())
                .build());
    }

    /**
     * 查询文档版本历史并转成前端可直接消费的 DTO。
     */
    /** 查询文档版本历史并转换为 DTO。 */
    public List<DocumentVersionDto> listVersions(Long documentId) {
        return documentVersionMapper.selectList(new LambdaQueryWrapper<DocumentVersionEntity>()
                        .eq(DocumentVersionEntity::getDocumentId, documentId)
                        .orderByDesc(DocumentVersionEntity::getVersion))
                .stream()
                .map(entity -> DocumentVersionDto.builder()
                        .version(entity.getVersion())
                        .sourceFileName(entity.getSourceFileName())
                        .parsedContent(entity.getParsedContent())
                        .timestamp(entity.getCreatedAt())
                        .engine(entity.getEngine())
                        .author(entity.getAuthor())
                        .status(entity.getStatus())
                        .summary(entity.getSummary())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * 查询文档审计记录并转成统一 DTO。
     */
    /** 查询文档审计记录并转换为 DTO。 */
    public List<AuditRecordDto> listAudits(Long documentId) {
        return documentAuditMapper.selectList(new LambdaQueryWrapper<DocumentAuditEntity>()
                        .eq(DocumentAuditEntity::getDocumentId, documentId)
                        .orderByDesc(DocumentAuditEntity::getCreatedAt))
                .stream()
                .map(entity -> AuditRecordDto.builder()
                        .id(entity.getId())
                        .version(entity.getVersion())
                        .action(AuditAction.valueOf(entity.getAction()))
                        .operatorId(entity.getOperatorId())
                        .operatorName(entity.getOperatorName())
                        .comment(entity.getComment())
                        .createdAt(entity.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * 将文档实体组装为接口层返回对象。
     */
    /** 将文档实体组装为前端直接消费的 DTO。 */
    public DocumentDto toDocumentDto(DocumentEntity entity) {
        UserSummaryDto creator = userQueryService.getById(entity.getCreatedBy());
        return DocumentDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .tags(jsonUtils.readList(entity.getTagsJson(), String.class))
                .currentVersion(entity.getCurrentVersion())
                .liveVersion(entity.getLiveVersion())
                .status(DocumentStatus.valueOf(entity.getStatus()))
                .departmentId(entity.getDepartmentId())
                .folderId(entity.getFolderId())
                .latestSourceFile(entity.getLatestSourceFile())
                .latestParsedText(entity.getLatestParsedText())
                .parseJob(toJobDto("parse", entity.getParseStatus(), entity.getUpdatedAt(), entity.getParseStartedAt(), entity.getParseFinishedAt(), entity.getParseErrorMessage(), entity.getParseAttemptCount(), entity.getParseEngine(), entity.getParseLastRunBy()))
                .ragJob(toJobDto("rag", entity.getRagStatus(), entity.getUpdatedAt(), entity.getRagStartedAt(), entity.getRagFinishedAt(), entity.getRagErrorMessage(), entity.getRagAttemptCount(), null, entity.getRagLastRunBy()))
                .rejectedReason(entity.getRejectedReason())
                .revisionSource(entity.getRevisionSourceDocumentId() == null ? null : RevisionSourceDto.builder()
                        .sourceDocumentId(entity.getRevisionSourceDocumentId())
                        .sourceVersion(entity.getRevisionSourceVersion())
                        .build())
                .liveDocumentId(entity.getLiveDocumentId())
                .isRevisionDraft(entity.getRevisionDraft() != null && entity.getRevisionDraft() == 1)
                .lockedFromStatus(entity.getLockedFromStatus())
                .versionHistory(listVersions(entity.getId()))
                .auditTrail(listAudits(entity.getId()))
                .accessControl(permissionSupportService.listDocumentPermissions(entity.getId()))
                .createdBy(creator == null ? "未知用户" : creator.getName())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    /**
     * 将审计记录转换为活动流项。
     */
    /** 将审计记录转换为工作台活动流项。 */
    public ActivityItemDto toActivityDto(DocumentAuditEntity entity) {
        DocumentEntity document = documentMapper.selectById(entity.getDocumentId());
        return ActivityItemDto.builder()
                .id(entity.getId())
                .user(entity.getOperatorName())
                .action(entity.getAction())
                .target(document == null ? "未知文档" : document.getName())
                .createdAt(entity.getCreatedAt())
                .type(entity.getAction().toLowerCase(Locale.ENGLISH))
                .tags(document == null ? java.util.Collections.<String>emptyList() : jsonUtils.readList(document.getTagsJson(), String.class))
                .build();
    }

    /**
     * 将文档实体转换为搜索结果对象。
     */
    /** 将文档实体转换为搜索结果对象。 */
    public SearchResultDto toSearchDto(DocumentEntity entity) {
        return SearchResultDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .tag(firstTag(entity.getTagsJson()))
                .snippet(entity.getLatestParsedText())
                .path(buildPath(entity))
                .date(entity.getUpdatedAt())
                .user(resolveUserName(entity.getCreatedBy()))
                .status(DocumentStatus.valueOf(entity.getStatus()))
                .sourceDocumentId(entity.getLiveDocumentId() == null ? entity.getId() : entity.getLiveDocumentId())
                .build();
    }

    public int optionalInteger(Integer value) {
        return value == null ? 0 : value;
    }

    public String trimFileName(String name) {
        if (name == null) {
            return "未命名文档";
        }
        int index = name.lastIndexOf('.');
        return index > 0 ? name.substring(0, index) : name;
    }

    public String resolveUserName(Long userId) {
        UserSummaryDto user = userQueryService.getById(userId);
        return user == null ? "未知用户" : user.getName();
    }

    public boolean containsAnyTag(String tagsJson, List<String> tags) {
        return jsonUtils.readList(tagsJson, String.class).stream().anyMatch(tags::contains);
    }

    private DocumentJobDto toJobDto(String type,
                                    String status,
                                    LocalDateTime updatedAt,
                                    LocalDateTime startedAt,
                                    LocalDateTime finishedAt,
                                    String errorMessage,
                                    Integer attemptCount,
                                    String engine,
                                    String lastRunBy) {
        return DocumentJobDto.builder()
                .type(type)
                .status(JobStatus.valueOf(status))
                .updatedAt(updatedAt)
                .startedAt(startedAt)
                .finishedAt(finishedAt)
                .errorMessage(errorMessage)
                .attemptCount(attemptCount)
                .engine(engine)
                .lastRunBy(lastRunBy)
                .build();
    }

    private String firstTag(String tagsJson) {
        List<String> tags = jsonUtils.readList(tagsJson, String.class);
        return tags.isEmpty() ? null : tags.get(0);
    }

    private String buildPath(DocumentEntity entity) {
        DepartmentEntity department = departmentMapper.selectById(entity.getDepartmentId());
        FolderEntity folder = entity.getFolderId() == null ? null : folderMapper.selectById(entity.getFolderId());
        return "文档空间 / "
                + (department == null ? "未分组" : department.getName())
                + " / "
                + (folder == null ? "未归档" : folder.getName());
    }
}
