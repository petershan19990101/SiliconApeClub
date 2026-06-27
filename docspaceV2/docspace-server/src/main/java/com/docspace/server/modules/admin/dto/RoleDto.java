package com.docspace.server.modules.admin.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RoleDto {

    private Long id;
    private String code;
    private String name;
    private String description;
    private Boolean enabled;
    private Boolean builtIn;
    private Boolean adminRole;
    private Integer memberCount;
}
