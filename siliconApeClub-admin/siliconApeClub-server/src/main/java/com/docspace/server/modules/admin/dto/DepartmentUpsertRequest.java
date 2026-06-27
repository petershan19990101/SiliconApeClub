package com.docspace.server.modules.admin.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DepartmentUpsertRequest {

    private Long parentId;

    @NotBlank
    private String name;
}
