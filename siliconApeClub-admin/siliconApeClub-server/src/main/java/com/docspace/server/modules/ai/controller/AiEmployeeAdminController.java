package com.docspace.server.modules.ai.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.admin.service.RbacPermissionService;
import com.docspace.server.modules.ai.dto.AiEmployeePackagesRequest;
import com.docspace.server.modules.ai.dto.AiEmployeeRequest;
import com.docspace.server.modules.ai.service.AiEmployeeService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import java.util.Map;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
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
    private final RbacPermissionService rbacPermissionService;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.view");
        return ApiResponse.success(aiEmployeeService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> get(@PathVariable Long id,
                                                @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.view");
        return ApiResponse.success(aiEmployeeService.get(id));
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@Valid @RequestBody AiEmployeeRequest request,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.manage");
        return ApiResponse.success(aiEmployeeService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<Map<String, Object>> update(@PathVariable Long id,
                                                   @Valid @RequestBody AiEmployeeRequest request,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.manage");
        return ApiResponse.success(aiEmployeeService.update(id, request));
    }

    @PutMapping("/{id}/position-packages")
    public ApiResponse<Map<String, Object>> updatePackages(@PathVariable Long id,
                                                           @RequestBody AiEmployeePackagesRequest request,
                                                           @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.manage");
        return ApiResponse.success(aiEmployeeService.updatePackages(id, request));
    }

    @PutMapping("/{id}/skills")
    public ApiResponse<Map<String, Object>> updateSkills(@PathVariable Long id,
                                                         @RequestBody Map<String, Object> request,
                                                         @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.manage");
        return ApiResponse.success(aiEmployeeService.replaceSkills(id, request, currentUser));
    }

    @PutMapping("/{id}/assessment-rules")
    public ApiResponse<Map<String, Object>> updateAssessmentRules(@PathVariable Long id,
                                                                  @RequestBody Map<String, Object> request,
                                                                  @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.manage");
        return ApiResponse.success(aiEmployeeService.replaceAssessmentRules(id, request));
    }

    @GetMapping("/{id}/performance")
    public ApiResponse<Map<String, Object>> performance(@PathVariable Long id,
                                                        @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.view");
        return ApiResponse.success(aiEmployeeService.performance(id));
    }

    @PostMapping("/{id}/usage-records")
    public ApiResponse<Map<String, Object>> recordUsage(@PathVariable Long id,
                                                        @RequestBody Map<String, Object> request,
                                                        @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.manage");
        return ApiResponse.success(aiEmployeeService.recordUsage(id, request));
    }

    @PostMapping("/{id}/offline")
    public ApiResponse<Map<String, Object>> offline(@PathVariable Long id,
                                                    @RequestBody(required = false) Map<String, Object> request,
                                                    @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.manage");
        return ApiResponse.success(aiEmployeeService.offline(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable Long id,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "organization_hr.manage");
        return ApiResponse.success(aiEmployeeService.offline(id, java.util.Collections.<String, Object>singletonMap("reason", "离职/下线")));
    }
}
