/**
 * DepartmentController 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.department.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.department.service.DepartmentDto;
import com.docspace.server.modules.department.service.DepartmentService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentService departmentService;

    @GetMapping
    public ApiResponse<List<DepartmentDto>> listDepartments() {
        return ApiResponse.success(departmentService.listDepartments());
    }
}

