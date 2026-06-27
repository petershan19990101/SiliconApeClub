package com.docspace.server.modules.document.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ParseArtifactDto {
    private Long id;
    private String artifactType;
    private String artifactName;
    private String mimeType;
    private Integer pageNo;
    private Integer sequenceNo;
    private Long sizeBytes;
    private LocalDateTime createdAt;
    private String contentUrl;
}
