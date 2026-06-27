package com.docspace.server.modules.admin.dto;

import java.util.List;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RolePermissionUpdateRequest {

    @NotNull
    private List<Long> menuIds;
}
