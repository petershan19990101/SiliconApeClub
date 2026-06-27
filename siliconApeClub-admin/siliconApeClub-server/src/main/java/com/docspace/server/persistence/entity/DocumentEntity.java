/**
 * 文档实体，对应文档主表，保存当前版本和任务状态。
 */
package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("ds_document")
public class DocumentEntity {

    /** 文档主键 ID。 */
    @TableId
    private Long id;
    /** 文档名称。 */
    private String name;
    /** 文档简介。 */
    private String description;
    /** 标签 JSON 数组。 */
    private String tagsJson;
    /** 当前工作版本号。 */
    private Integer currentVersion;
    /** 已发布版本号。 */
    private Integer liveVersion;
    /** 生命周期状态。 */
    private String status;
    /** 归属部门 ID。 */
    private Long departmentId;
    /** 所在目录 ID。 */
    private Long folderId;
    /** 最新源文件名。 */
    private String latestSourceFile;
    /** 最新解析正文。 */
    private String latestParsedText;

    /** 解析任务状态。 */
    private String parseStatus;
    /** 解析开始时间。 */
    private LocalDateTime parseStartedAt;
    /** 解析完成时间。 */
    private LocalDateTime parseFinishedAt;
    /** 解析尝试次数。 */
    private Integer parseAttemptCount;
    /** 解析引擎名称。 */
    private String parseEngine;
    /** 解析失败原因。 */
    private String parseErrorMessage;
    /** 最近一次触发解析的用户名称。 */
    private String parseLastRunBy;

    /** RAG 同步任务状态。 */
    private String ragStatus;
    /** RAG 同步开始时间。 */
    private LocalDateTime ragStartedAt;
    /** RAG 同步完成时间。 */
    private LocalDateTime ragFinishedAt;
    /** RAG 同步尝试次数。 */
    private Integer ragAttemptCount;
    /** RAG 同步失败原因。 */
    private String ragErrorMessage;
    /** 最近一次触发 RAG 同步的用户名称。 */
    private String ragLastRunBy;

    /** 审核驳回原因。 */
    private String rejectedReason;
    /** 修订草稿来源文档 ID。 */
    private Long revisionSourceDocumentId;
    /** 修订草稿来源版本号。 */
    private Integer revisionSourceVersion;
    /** 关联的线上主文档 ID。 */
    private Long liveDocumentId;
    /** 是否为修订草稿。 */
    private Integer revisionDraft;
    /** 锁定前的原始状态。 */
    private String lockedFromStatus;

    /** 对象存储桶名称。 */
    private String storageBucket;
    /** 对象存储文件键。 */
    private String storageObject;
    /** 创建人 ID。 */
    private Long createdBy;
    /** 逻辑删除标记。 */
    private Integer deleted;
    /** 创建时间。 */
    private LocalDateTime createdAt;
    /** 更新时间。 */
    private LocalDateTime updatedAt;
}
