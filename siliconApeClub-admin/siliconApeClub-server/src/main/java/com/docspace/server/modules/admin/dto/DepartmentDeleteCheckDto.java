package com.docspace.server.modules.admin.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DepartmentDeleteCheckDto {

    private Long departmentId;
    private String departmentName;
    private Long parentId;
    private String parentName;
    private Integer childDepartmentCount;
    private Integer userCount;
    private Integer folderCount;
    private Integer documentCount;
    private Boolean topLevel;
}
