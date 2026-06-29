package com.docspace.server.modules.admin.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AiModelProfileDto {
    private Long id;
    private String profileCode;
    private String profileName;
    private String provider;
    private String purpose;
    private String endpoint;
    private Boolean apiKeyConfigured;
    private String apiKeyMasked;
    private String modelName;
    private Integer dimensions;
    private Integer timeoutSeconds;
    private Boolean enabled;
    private Boolean defaultProfile;
    private Boolean fallbackEnabled;
    private String configJson;
    private LocalDateTime updatedAt;
}
