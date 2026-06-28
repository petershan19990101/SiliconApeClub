package com.docspace.server.modules.ai.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.admin.service.RbacPermissionService;
import com.docspace.server.modules.ai.service.SkillRepositoryService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/skill-repository")
@RequiredArgsConstructor
public class SkillRepositoryController {

    private final SkillRepositoryService skillRepositoryService;
    private final RbacPermissionService rbacPermissionService;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) String reviewStatus,
                                                       @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "skill_repository.view");
        return ApiResponse.success(skillRepositoryService.list(reviewStatus));
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> get(@PathVariable Long id,
                                                @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "skill_repository.view");
        return ApiResponse.success(skillRepositoryService.get(id));
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@RequestBody Map<String, Object> request,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "skill_repository.manage");
        return ApiResponse.success(skillRepositoryService.create(request, currentUser));
    }

    @PutMapping("/{id}")
    public ApiResponse<Map<String, Object>> update(@PathVariable Long id,
                                                   @RequestBody Map<String, Object> request,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "skill_repository.manage");
        return ApiResponse.success(skillRepositoryService.update(id, request, currentUser));
    }

    @PostMapping("/{id}/submit-review")
    public ApiResponse<Map<String, Object>> submitReview(@PathVariable Long id,
                                                         @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "skill_repository.manage");
        return ApiResponse.success(skillRepositoryService.submitReview(id));
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<Map<String, Object>> approve(@PathVariable Long id,
                                                    @RequestBody(required = false) Map<String, Object> request,
                                                    @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "skill_repository.manage");
        return ApiResponse.success(skillRepositoryService.approve(id, request, currentUser));
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<Map<String, Object>> reject(@PathVariable Long id,
                                                   @RequestBody(required = false) Map<String, Object> request,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "skill_repository.manage");
        return ApiResponse.success(skillRepositoryService.reject(id, request));
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<Map<String, Object>> archive(@PathVariable Long id,
                                                    @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "skill_repository.manage");
        return ApiResponse.success(skillRepositoryService.archive(id));
    }
}
