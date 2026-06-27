/**
 * SearchResultDto 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import com.docspace.server.common.enums.DocumentStatus;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SearchResultDto {

    private Long id;
    private String name;
    private String tag;
    private String snippet;
    private String path;
    private LocalDateTime date;
    private String user;
    private DocumentStatus status;
    private Long sourceDocumentId;
}

