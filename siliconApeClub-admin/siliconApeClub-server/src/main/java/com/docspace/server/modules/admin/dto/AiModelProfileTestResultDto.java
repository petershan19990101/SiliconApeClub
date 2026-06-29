package com.docspace.server.modules.admin.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AiModelProfileTestResultDto {
    private String status;
    private String provider;
    private String purpose;
    private String modelName;
    private Boolean realCall;
    private Boolean fallbackUsed;
    private String message;
    private Integer embeddingDimensions;
    private String sample;
}
