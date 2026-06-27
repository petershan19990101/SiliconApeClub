package com.docspace.server.modules.admin.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.admin.dto.ParseEngineBindingAdminDto;
import com.docspace.server.modules.admin.dto.ParseEngineBindingUpsertRequest;
import com.docspace.server.modules.admin.dto.RegisteredParseEngineDto;
import com.docspace.server.modules.admin.service.ParseEngineBindingAdminService;
import com.docspace.server.modules.admin.service.RbacPermissionService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
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
public class SettingsAdminController {

    private final RbacPermissionService rbacPermissionService;
    private final ParseEngineBindingAdminService parseEngineBindingAdminService;

    @GetMapping("/parse-engines/catalog")
    public ApiResponse<List<RegisteredParseEngineDto>> parseEngineCatalog(@AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "settings.parse_config.view");
        return ApiResponse.success(parseEngineBindingAdminService.listRegisteredEngines());
    }

    @GetMapping("/parse-engine-bindings")
    public ApiResponse<List<ParseEngineBindingAdminDto>> parseEngineBindings(@AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "settings.parse_config.view");
        return ApiResponse.success(parseEngineBindingAdminService.listBindings());
    }

    @PostMapping("/parse-engine-bindings")
    public ApiResponse<ParseEngineBindingAdminDto> createParseEngineBinding(@Valid @RequestBody ParseEngineBindingUpsertRequest request,
                                                                            @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "settings.parse_config.create");
        return ApiResponse.success(parseEngineBindingAdminService.create(request, currentUser));
    }

    @PutMapping("/parse-engine-bindings/{id}")
    public ApiResponse<ParseEngineBindingAdminDto> updateParseEngineBinding(@PathVariable Long id,
                                                                            @Valid @RequestBody ParseEngineBindingUpsertRequest request,
                                                                            @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "settings.parse_config.edit");
        return ApiResponse.success(parseEngineBindingAdminService.update(id, request, currentUser));
    }

    @DeleteMapping("/parse-engine-bindings/{id}")
    public ApiResponse<Void> deleteParseEngineBinding(@PathVariable Long id,
                                                      @AuthenticationPrincipal SecurityUser currentUser) {
        rbacPermissionService.ensurePermission(currentUser, "settings.parse_config.delete");
        parseEngineBindingAdminService.delete(id, currentUser);
        return ApiResponse.success("删除成功", null);
    }
}
