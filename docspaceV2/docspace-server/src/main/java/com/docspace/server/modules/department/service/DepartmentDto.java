/**
 * DepartmentDto 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.department.service;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DepartmentDto {

    private Long id;
    private Long parentId;
    private String name;
}

