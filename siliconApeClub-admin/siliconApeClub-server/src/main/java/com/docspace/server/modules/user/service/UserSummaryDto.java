package com.docspace.server.modules.user.service;

import com.docspace.server.common.enums.UserRole;
import com.docspace.server.modules.admin.dto.RoleOptionDto;
import com.docspace.server.modules.admin.dto.SystemMenuDto;
import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserSummaryDto {

    private Long id;
    private String username;
    private String name;
    private String email;
    private UserRole role;
    private Long departmentId;
    private String departmentName;
    private List<String> permissions;
    private List<RoleOptionDto> roles;
    private List<SystemMenuDto> menus;
    private List<String> buttonPermissions;
}
