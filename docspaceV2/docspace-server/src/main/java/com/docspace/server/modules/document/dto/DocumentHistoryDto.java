/**
 * DocumentHistoryDto 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DocumentHistoryDto {

    private List<DocumentVersionDto> versions;
    private List<AuditRecordDto> audits;
}

