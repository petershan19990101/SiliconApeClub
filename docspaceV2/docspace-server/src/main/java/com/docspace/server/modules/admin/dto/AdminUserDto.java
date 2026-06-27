package com.docspace.server.modules.admin.dto;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminUserDto {

    private Long id;
    private String username;
    private String displayName;
    private String email;
    private Long departmentId;
    private String departmentName;
    private Boolean enabled;
    private String primaryRoleCode;
    private List<RoleOptionDto> roles;
}
