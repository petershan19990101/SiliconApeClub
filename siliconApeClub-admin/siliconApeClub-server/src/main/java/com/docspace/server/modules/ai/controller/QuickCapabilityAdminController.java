package com.docspace.server.modules.ai.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.admin.service.RbacPermissionService;
import com.docspace.server.modules.ai.service.QuickCapabilityAdminService;
import com.docspace.server.security.SecurityUser;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/quick-capabilities")
@RequiredArgsConstructor
public class QuickCapabilityAdminController {

    private final QuickCapabilityAdminService quickCapabilityAdminService;
    private final RbacPermissionService rbacPermissionService;

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview(@AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "quick_capability.view");
        return ApiResponse.success(quickCapabilityAdminService.overview());
    }

    @PostMapping("/groups")
    public ApiResponse<Map<String, Object>> createGroup(@RequestBody Map<String, Object> request,
                                                        @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "quick_capability.manage");
        return ApiResponse.success(quickCapabilityAdminService.createGroup(request));
    }

    @PutMapping("/groups/{id}")
    public ApiResponse<Map<String, Object>> updateGroup(@PathVariable Long id,
                                                        @RequestBody Map<String, Object> request,
                                                        @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "quick_capability.manage");
        return ApiResponse.success(quickCapabilityAdminService.updateGroup(id, request));
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> createCapability(@RequestBody Map<String, Object> request,
                                                             @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "quick_capability.manage");
        return ApiResponse.success(quickCapabilityAdminService.createCapability(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<Map<String, Object>> updateCapability(@PathVariable Long id,
                                                             @RequestBody Map<String, Object> request,
                                                             @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "quick_capability.manage");
        return ApiResponse.success(quickCapabilityAdminService.updateCapability(id, request));
    }

    @PostMapping("/{id}/enable")
    public ApiResponse<Map<String, Object>> enable(@PathVariable Long id,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "quick_capability.manage");
        return ApiResponse.success(quickCapabilityAdminService.setCapabilityEnabled(id, true));
    }

    @PostMapping("/{id}/disable")
    public ApiResponse<Map<String, Object>> disable(@PathVariable Long id,
                                                    @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "quick_capability.manage");
        return ApiResponse.success(quickCapabilityAdminService.setCapabilityEnabled(id, false));
    }
}
