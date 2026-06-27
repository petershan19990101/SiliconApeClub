package com.docspace.server.modules.ai.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.ai.dto.AiEmployeePackagesRequest;
import com.docspace.server.modules.ai.dto.AiEmployeeRequest;
import com.docspace.server.modules.ai.service.AiEmployeeService;
import java.util.List;
import java.util.Map;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/ai-employees")
@RequiredArgsConstructor
public class AiEmployeeAdminController {

    private final AiEmployeeService aiEmployeeService;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list() {
        return ApiResponse.success(aiEmployeeService.list());
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@Valid @RequestBody AiEmployeeRequest request) {
        return ApiResponse.success(aiEmployeeService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<Map<String, Object>> update(@PathVariable Long id,
                                                   @Valid @RequestBody AiEmployeeRequest request) {
        return ApiResponse.success(aiEmployeeService.update(id, request));
    }

    @PutMapping("/{id}/position-packages")
    public ApiResponse<Map<String, Object>> updatePackages(@PathVariable Long id,
                                                           @RequestBody AiEmployeePackagesRequest request) {
        return ApiResponse.success(aiEmployeeService.updatePackages(id, request));
    }
}
