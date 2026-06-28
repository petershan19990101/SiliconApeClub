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
    private String roleTitle;
    private String responsibilities;
    private String skillsJson;
    private String contactRelationsJson;
    private String memoryPolicyJson;
    private String modelConfigJson;
    private String hrRoleCode;
    private Long managerEmployeeId;
    private String employmentType;
    private java.math.BigDecimal costRate;
    private String performanceStatus;
    private Boolean enabled;
}
