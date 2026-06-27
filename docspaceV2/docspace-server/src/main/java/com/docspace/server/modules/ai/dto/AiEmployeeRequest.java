package com.docspace.server.modules.ai.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AiEmployeeRequest {
    @NotBlank
    private String code;
    @NotBlank
    private String name;
    private String description;
    private String positionCode;
    private Long departmentId;
    private Boolean enabled;
}
