package com.docspace.server.modules.admin.dto;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminDepartmentDto {

    private Long id;
    private Long parentId;
    private String name;
    private List<AdminDepartmentDto> children;
}
