/**
 * 文档详情 DTO，供前端列表、详情和弹窗直接消费。
 */
package com.docspace.server.modules.document.dto;

import com.docspace.server.common.enums.DocumentStatus;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DocumentDto {

    /** 文档主键 ID。 */
    private Long id;
    /** 文档名称。 */
    private String name;
    /** 文档简介。 */
    private String description;
    /** 标签列表。 */
    private List<String> tags;
    /** 当前工作版本号。 */
    private Integer currentVersion;
    /** 已发布版本号。 */
    private Integer liveVersion;
    /** 生命周期状态。 */
    private DocumentStatus status;
    /** 归属部门 ID。 */
    private Long departmentId;
    /** 所在目录 ID。 */
    private Long folderId;
    /** 最新源文件名称。 */
    private String latestSourceFile;
    /** 最新解析文本。 */
    private String latestParsedText;
    /** 解析任务信息。 */
    private DocumentJobDto parseJob;
    /** RAG 同步任务信息。 */
    private DocumentJobDto ragJob;
    /** 驳回原因。 */
    private String rejectedReason;
    /** 修订来源信息。 */
    private RevisionSourceDto revisionSource;
    /** 关联的线上主文档 ID。 */
    private Long liveDocumentId;
    /** 是否为修订草稿。 */
    private Boolean isRevisionDraft;
    /** 锁定前状态。 */
    private String lockedFromStatus;
    /** 版本历史列表。 */
    private List<DocumentVersionDto> versionHistory;
    /** 审计轨迹列表。 */
    private List<AuditRecordDto> auditTrail;
    /** 权限配置列表。 */
    private List<AccessControlEntryDto> accessControl;
    /** 创建人名称。 */
    private String createdBy;
    /** 创建时间。 */
    private LocalDateTime createdAt;
    /** 更新时间。 */
    private LocalDateTime updatedAt;
}
