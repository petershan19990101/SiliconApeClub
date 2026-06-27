/**
 * AuditRecordDto 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import com.docspace.server.common.enums.AuditAction;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuditRecordDto {

    private Long id;
    private Integer version;
    private AuditAction action;
    private Long operatorId;
    private String operatorName;
    private String comment;
    private LocalDateTime createdAt;
}

