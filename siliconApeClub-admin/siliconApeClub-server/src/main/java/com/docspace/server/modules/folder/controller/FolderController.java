package com.docspace.server.modules.folder.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.document.dto.PermissionUpdateRequest;
import com.docspace.server.modules.folder.dto.CreateFolderRequest;
import com.docspace.server.modules.folder.dto.FolderDeleteCheckDto;
import com.docspace.server.modules.folder.dto.FolderDto;
import com.docspace.server.modules.folder.service.FolderService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/folders")
@RequiredArgsConstructor
public class FolderController {

    private final FolderService folderService;

    @GetMapping
    public ApiResponse<List<FolderDto>> listFolders(@RequestParam(required = false) Long departmentId,
                                                    @RequestParam(required = false) Long parentId) {
        return ApiResponse.success(folderService.listFolders(departmentId, parentId));
    }

    @PostMapping
    public ApiResponse<FolderDto> createFolder(@Valid @RequestBody CreateFolderRequest request,
                                               @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(folderService.createFolder(request, currentUser));
    }

    @GetMapping("/{id}/delete-check")
    public ApiResponse<FolderDeleteCheckDto> deleteCheck(@PathVariable Long id) {
        return ApiResponse.success(folderService.checkDeletion(id));
    }

    @PutMapping("/{id}/permissions")
    public ApiResponse<Void> updatePermissions(@PathVariable Long id,
                                               @Valid @RequestBody PermissionUpdateRequest request) {
        folderService.updatePermissions(id, request);
        return ApiResponse.success("权限更新成功", null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteFolder(@PathVariable Long id,
                                          @AuthenticationPrincipal SecurityUser currentUser) {
        folderService.deleteFolder(id, currentUser);
        return ApiResponse.success("删除成功", null);
    }
}
