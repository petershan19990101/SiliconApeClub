package com.docspace.server.modules.admin.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.admin.dto.AdminDepartmentDto;
import com.docspace.server.modules.admin.dto.AdminUserDto;
import com.docspace.server.modules.admin.dto.DepartmentDeleteCheckDto;
import com.docspace.server.modules.admin.dto.DepartmentUpsertRequest;
import com.docspace.server.modules.admin.dto.MenuUpsertRequest;
import com.docspace.server.modules.admin.dto.RoleDto;
import com.docspace.server.modules.admin.dto.RolePermissionUpdateRequest;
import com.docspace.server.modules.admin.dto.RoleUpsertRequest;
import com.docspace.server.modules.admin.dto.SystemMenuDto;
import com.docspace.server.modules.admin.dto.UserResetPasswordRequest;
import com.docspace.server.modules.admin.dto.UserRoleUpdateRequest;
import com.docspace.server.modules.admin.dto.UserUpsertRequest;
import com.docspace.server.modules.admin.service.DepartmentAdminService;
import com.docspace.server.modules.admin.service.MenuAdminService;
import com.docspace.server.modules.admin.service.RbacPermissionService;
import com.docspace.server.modules.admin.service.RoleAdminService;
import com.docspace.server.modules.admin.service.UserAdminService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import java.util.Set;
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
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class PermissionAdminController {

    private final RbacPermissionService rbacPermissionService;
    private final MenuAdminService menuAdminService;
    private final RoleAdminService roleAdminService;
    private final UserAdminService userAdminService;
    private final DepartmentAdminService departmentAdminService;

    @GetMapping("/menus")
    public ApiResponse<List<SystemMenuDto>> menus(@AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.menu.view");
        return ApiResponse.success(menuAdminService.listMenus());
    }

    @GetMapping("/menus/tree")
    public ApiResponse<List<SystemMenuDto>> menuTree(@AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.menu.view");
        return ApiResponse.success(menuAdminService.listMenuTree());
    }

    @PostMapping("/menus")
    public ApiResponse<SystemMenuDto> createMenu(@Valid @RequestBody MenuUpsertRequest request,
                                                 @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.menu.create");
        return ApiResponse.success(menuAdminService.create(request, currentUser));
    }

    @PutMapping("/menus/{id}")
    public ApiResponse<SystemMenuDto> updateMenu(@PathVariable Long id,
                                                 @Valid @RequestBody MenuUpsertRequest request,
                                                 @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.menu.edit");
        return ApiResponse.success(menuAdminService.update(id, request, currentUser));
    }

    @DeleteMapping("/menus/{id}")
    public ApiResponse<Void> deleteMenu(@PathVariable Long id,
                                        @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.menu.delete");
        menuAdminService.delete(id, currentUser);
        return ApiResponse.success("删除成功", null);
    }

    @GetMapping("/roles")
    public ApiResponse<List<RoleDto>> roles(@AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.role.view");
        return ApiResponse.success(roleAdminService.listRoles());
    }

    @PostMapping("/roles")
    public ApiResponse<RoleDto> createRole(@Valid @RequestBody RoleUpsertRequest request,
                                           @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.role.create");
        return ApiResponse.success(roleAdminService.create(request, currentUser));
    }

    @PutMapping("/roles/{id}")
    public ApiResponse<RoleDto> updateRole(@PathVariable Long id,
                                           @Valid @RequestBody RoleUpsertRequest request,
                                           @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.role.edit");
        return ApiResponse.success(roleAdminService.update(id, request, currentUser));
    }

    @DeleteMapping("/roles/{id}")
    public ApiResponse<Void> deleteRole(@PathVariable Long id,
                                        @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.role.delete");
        roleAdminService.delete(id, currentUser);
        return ApiResponse.success("删除成功", null);
    }

    @GetMapping("/roles/{id}/permissions")
    public ApiResponse<Set<Long>> rolePermissions(@PathVariable Long id,
                                                  @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.role.view");
        return ApiResponse.success(roleAdminService.getPermissionIds(id));
    }

    @PutMapping("/roles/{id}/permissions")
    public ApiResponse<Void> updateRolePermissions(@PathVariable Long id,
                                                   @Valid @RequestBody RolePermissionUpdateRequest request,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.role.assign");
        roleAdminService.updatePermissions(id, request.getMenuIds(), currentUser);
        return ApiResponse.success("授权成功", null);
    }

    @GetMapping("/users")
    public ApiResponse<List<AdminUserDto>> users(@AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.user.view");
        return ApiResponse.success(userAdminService.listUsers());
    }

    @PostMapping("/users")
    public ApiResponse<AdminUserDto> createUser(@Valid @RequestBody UserUpsertRequest request,
                                                @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.user.create");
        return ApiResponse.success(userAdminService.create(request, currentUser));
    }

    @PutMapping("/users/{id}")
    public ApiResponse<AdminUserDto> updateUser(@PathVariable Long id,
                                                @Valid @RequestBody UserUpsertRequest request,
                                                @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.user.edit");
        return ApiResponse.success(userAdminService.update(id, request, currentUser));
    }

    @PostMapping("/users/{id}/enable")
    public ApiResponse<Void> enableUser(@PathVariable Long id,
                                        @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.user.enable");
        userAdminService.enable(id, currentUser);
        return ApiResponse.success("启用成功", null);
    }

    @PostMapping("/users/{id}/disable")
    public ApiResponse<Void> disableUser(@PathVariable Long id,
                                         @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.user.disable");
        userAdminService.disable(id, currentUser);
        return ApiResponse.success("停用成功", null);
    }

    @PutMapping("/users/{id}/roles")
    public ApiResponse<Void> updateUserRoles(@PathVariable Long id,
                                             @Valid @RequestBody UserRoleUpdateRequest request,
                                             @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.user.assign_role");
        userAdminService.updateRoles(id, request.getRoleIds(), currentUser);
        return ApiResponse.success("角色更新成功", null);
    }

    @PostMapping("/users/{id}/reset-password")
    public ApiResponse<Void> resetPassword(@PathVariable Long id,
                                           @Valid @RequestBody UserResetPasswordRequest request,
                                           @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.user.reset_password");
        userAdminService.resetPassword(id, request, currentUser);
        return ApiResponse.success("密码重置成功", null);
    }

    @GetMapping("/departments")
    public ApiResponse<List<AdminDepartmentDto>> departments(@AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.department.view");
        return ApiResponse.success(departmentAdminService.listDepartments());
    }

    @GetMapping("/departments/tree")
    public ApiResponse<List<AdminDepartmentDto>> departmentTree(@AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.department.view");
        return ApiResponse.success(departmentAdminService.listDepartmentTree());
    }

    @PostMapping("/departments")
    public ApiResponse<AdminDepartmentDto> createDepartment(@Valid @RequestBody DepartmentUpsertRequest request,
                                                            @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.department.create");
        return ApiResponse.success(departmentAdminService.create(request, currentUser));
    }

    @PutMapping("/departments/{id}")
    public ApiResponse<AdminDepartmentDto> updateDepartment(@PathVariable Long id,
                                                            @Valid @RequestBody DepartmentUpsertRequest request,
                                                            @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.department.edit");
        return ApiResponse.success(departmentAdminService.update(id, request, currentUser));
    }

    @GetMapping("/departments/{id}/delete-check")
    public ApiResponse<DepartmentDeleteCheckDto> departmentDeleteCheck(@PathVariable Long id,
                                                                       @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.department.delete");
        return ApiResponse.success(departmentAdminService.getDeleteCheck(id));
    }

    @DeleteMapping("/departments/{id}")
    public ApiResponse<Void> deleteDepartment(@PathVariable Long id,
                                              @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "permission.department.delete");
        departmentAdminService.delete(id, currentUser);
        return ApiResponse.success("删除成功", null);
    }
}
