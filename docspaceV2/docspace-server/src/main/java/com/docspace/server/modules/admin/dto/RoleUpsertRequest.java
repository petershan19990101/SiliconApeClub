package com.docspace.server.modules.admin.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RoleUpsertRequest {

    @NotBlank
    private String code;
    @NotBlank
    private String name;
    private String description;
    @NotNull
    private Boolean enabled;
    @NotNull
    private Boolean adminRole;
}
