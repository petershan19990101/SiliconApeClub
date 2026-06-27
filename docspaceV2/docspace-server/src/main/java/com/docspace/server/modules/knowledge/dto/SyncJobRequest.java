package com.docspace.server.modules.knowledge.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SyncJobRequest {
    @NotBlank
    private String sourceType;
    @NotNull
    private Long sourceId;
    @NotNull
    private Integer sourceVersion;
}
