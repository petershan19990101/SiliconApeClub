/**
 * DocumentJobDto 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import com.docspace.server.common.enums.JobStatus;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DocumentJobDto {

    private String type;
    private JobStatus status;
    private LocalDateTime updatedAt;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private String errorMessage;
    private Integer attemptCount;
    private String engine;
    private String lastRunBy;
}

