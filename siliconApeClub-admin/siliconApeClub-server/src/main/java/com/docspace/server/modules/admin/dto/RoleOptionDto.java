package com.docspace.server.modules.admin.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RoleOptionDto {

    private Long id;
    private String code;
    private String name;
    private Boolean enabled;
    private Boolean builtIn;
    private Boolean adminRole;
}
