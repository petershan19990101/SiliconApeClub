/**
 * RevisionSourceDto 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RevisionSourceDto {

    private Long sourceDocumentId;
    private Integer sourceVersion;
}

