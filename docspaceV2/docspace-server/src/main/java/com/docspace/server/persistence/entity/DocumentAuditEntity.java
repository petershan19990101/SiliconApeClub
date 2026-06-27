/**
 * 文档审计实体，对应文档生命周期日志表。
 */
package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("ds_document_audit")
public class DocumentAuditEntity {

    /** 审计记录主键。 */
    @TableId
    private Long id;
    /** 关联文档 ID。 */
    private Long documentId;
    /** 关联版本号。 */
    private Integer version;
    /** 审计动作。 */
    private String action;
    /** 操作人 ID。 */
    private Long operatorId;
    /** 操作人名称。 */
    private String operatorName;
    /** 操作说明。 */
    private String comment;
    /** 创建时间。 */
    private LocalDateTime createdAt;
}
