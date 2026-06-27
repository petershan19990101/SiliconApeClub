/**
 * DocumentVersionDto 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DocumentVersionDto {

    private Integer version;
    private String sourceFileName;
    private String parsedContent;
    private LocalDateTime timestamp;
    private String engine;
    private String author;
    private String status;
    private String summary;
}

