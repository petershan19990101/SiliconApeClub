package com.docspace.server.modules.admin.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AiModelProfileUpsertRequest {
    @NotBlank
    private String profileName;
    @NotBlank
    private String provider;
    @NotBlank
    private String purpose;
    @NotBlank
    private String endpoint;
    private String apiKey;
    @NotBlank
    private String modelName;
    private Integer dimensions;
    @NotNull
    private Integer timeoutSeconds;
    @NotNull
    private Boolean enabled;
    @NotNull
    private Boolean defaultProfile;
    @NotNull
    private Boolean fallbackEnabled;
    private String configJson;
}
