/**
 * 权限支撑服务，负责目录和文档权限的默认生成、复制与持久化。
 */
package com.docspace.server.modules.document.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.common.enums.UserRole;
import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.modules.document.dto.AccessControlEntryDto;
import com.docspace.server.persistence.entity.DocumentPermissionEntity;
import com.docspace.server.persistence.entity.FolderPermissionEntity;
import com.docspace.server.persistence.entity.UserEntity;
import com.docspace.server.persistence.mapper.DocumentPermissionMapper;
import com.docspace.server.persistence.mapper.FolderPermissionMapper;
import com.docspace.server.persistence.mapper.UserMapper;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PermissionSupportService {

    private final FolderPermissionMapper folderPermissionMapper;
    private final DocumentPermissionMapper documentPermissionMapper;
    private final UserMapper userMapper;
    private final JsonUtils jsonUtils;

    /**
     * 查询目录级权限并转换为接口 DTO。
     */
    /** 查询目录级权限并转换为接口 DTO。 */
    public List<AccessControlEntryDto> listFolderPermissions(Long folderId) {
        List<FolderPermissionEntity> entities = folderPermissionMapper.selectList(
                new LambdaQueryWrapper<FolderPermissionEntity>().eq(FolderPermissionEntity::getFolderId, folderId));
        return buildDtos(entities.stream().map(entity -> RawPermission.builder()
                .userId(entity.getUserId())
                .roleCode(entity.getRoleCode())
                .permissionsJson(entity.getPermissionsJson())
                .inheritedFrom(entity.getInheritedFrom())
                .build()).collect(Collectors.toList()));
    }

    /**
     * 查询文档级权限并转换为接口 DTO。
     */
    /** 查询文档级权限并转换为接口 DTO。 */
    public List<AccessControlEntryDto> listDocumentPermissions(Long documentId) {
        List<DocumentPermissionEntity> entities = documentPermissionMapper.selectList(
                new LambdaQueryWrapper<DocumentPermissionEntity>().eq(DocumentPermissionEntity::getDocumentId, documentId));
        return buildDtos(entities.stream().map(entity -> RawPermission.builder()
                .userId(entity.getUserId())
                .roleCode(entity.getRoleCode())
                .permissionsJson(entity.getPermissionsJson())
                .inheritedFrom(entity.getInheritedFrom())
                .build()).collect(Collectors.toList()));
    }

    /**
     * 用新数据整体替换目录权限配置。
     */
    /** 用新数据整体替换目录权限配置。 */
    public void replaceFolderPermissions(Long folderId, List<AccessControlEntryDto> entries) {
        folderPermissionMapper.delete(new QueryWrapper<FolderPermissionEntity>().eq("folder_id", folderId));
        LocalDateTime now = LocalDateTime.now();
        for (AccessControlEntryDto entry : entries) {
            FolderPermissionEntity entity = new FolderPermissionEntity();
            entity.setFolderId(folderId);
            entity.setUserId(entry.getUserId());
            entity.setRoleCode(entry.getRole().name());
            entity.setPermissionsJson(jsonUtils.toJson(entry.getPermissions()));
            entity.setInheritedFrom(entry.getInheritedFrom());
            entity.setCreatedAt(now);
            entity.setUpdatedAt(now);
            folderPermissionMapper.insert(entity);
        }
    }

    /**
     * 用新数据整体替换文档权限配置。
     */
    /** 用新数据整体替换文档权限配置。 */
    public void replaceDocumentPermissions(Long documentId, List<AccessControlEntryDto> entries) {
        documentPermissionMapper.delete(new QueryWrapper<DocumentPermissionEntity>().eq("document_id", documentId));
        LocalDateTime now = LocalDateTime.now();
        for (AccessControlEntryDto entry : entries) {
            DocumentPermissionEntity entity = new DocumentPermissionEntity();
            entity.setDocumentId(documentId);
            entity.setUserId(entry.getUserId());
            entity.setRoleCode(entry.getRole().name());
            entity.setPermissionsJson(jsonUtils.toJson(entry.getPermissions()));
            entity.setInheritedFrom(entry.getInheritedFrom());
            entity.setCreatedAt(now);
            entity.setUpdatedAt(now);
            documentPermissionMapper.insert(entity);
        }
    }

    /**
     * 为新建文档生成默认权限集合。
     */
    /** 为新建文档生成默认权限集合。 */
    public void seedDefaultDocumentPermissions(Long documentId, Long departmentId, Long operatorId) {
        List<UserEntity> users = userMapper.selectList(new LambdaQueryWrapper<UserEntity>()
                .and(wrapper -> wrapper.eq(UserEntity::getDepartmentId, departmentId)
                        .or()
                        .eq(UserEntity::getRoleCode, UserRole.ADMIN.name())));
        List<AccessControlEntryDto> entries = new ArrayList<AccessControlEntryDto>();
        for (UserEntity user : users) {
            entries.add(AccessControlEntryDto.builder()
                    .userId(user.getId())
                    .userName(user.getDisplayName())
                    .role(UserRole.valueOf(user.getRoleCode()))
                    .permissions(defaultDocumentPermissions(user.getRoleCode(), user.getId().equals(operatorId)))
                    .build());
        }
        replaceDocumentPermissions(documentId, entries);
    }

    /**
     * 为新建目录生成默认权限集合。
     */
    /** 为新建目录生成默认权限集合。 */
    public void seedDefaultFolderPermissions(Long folderId, Long departmentId) {
        List<UserEntity> users = userMapper.selectList(new LambdaQueryWrapper<UserEntity>()
                .and(wrapper -> wrapper.eq(UserEntity::getDepartmentId, departmentId)
                        .or()
                        .eq(UserEntity::getRoleCode, UserRole.ADMIN.name())));
        List<AccessControlEntryDto> entries = users.stream()
                .map(user -> AccessControlEntryDto.builder()
                        .userId(user.getId())
                        .userName(user.getDisplayName())
                        .role(UserRole.valueOf(user.getRoleCode()))
                        .permissions(defaultFolderPermissions(user.getRoleCode()))
                        .build())
                .collect(Collectors.toList());
        replaceFolderPermissions(folderId, entries);
    }

    /**
     * 从已有文档复制权限到新修订草稿。
     */
    /** 从已有文档复制权限到新修订草稿。 */
    public void copyDocumentPermissions(Long sourceDocumentId, Long targetDocumentId) {
        replaceDocumentPermissions(targetDocumentId, listDocumentPermissions(sourceDocumentId));
    }

    public void ensureCanViewDocument(Long documentId, SecurityUser currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new BusinessException("当前登录状态无效");
        }
        if (currentUser.getRole() == UserRole.ADMIN) {
            return;
        }
        DocumentPermissionEntity permission = documentPermissionMapper.selectOne(
                new LambdaQueryWrapper<DocumentPermissionEntity>()
                        .eq(DocumentPermissionEntity::getDocumentId, documentId)
                        .eq(DocumentPermissionEntity::getUserId, currentUser.getId())
                        .last("limit 1"));
        if (permission == null) {
            throw new BusinessException("无权访问该文档");
        }
        List<String> permissions = jsonUtils.readList(permission.getPermissionsJson(), String.class);
        if (!permissions.contains("view")) {
            throw new BusinessException("无权访问该文档");
        }
    }

    public void ensureCanDeleteDocument(Long documentId, SecurityUser currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new BusinessException("当前登录状态无效");
        }
        if (currentUser.getRole() == UserRole.ADMIN) {
            return;
        }
        DocumentPermissionEntity permission = documentPermissionMapper.selectOne(
                new LambdaQueryWrapper<DocumentPermissionEntity>()
                        .eq(DocumentPermissionEntity::getDocumentId, documentId)
                        .eq(DocumentPermissionEntity::getUserId, currentUser.getId())
                        .last("limit 1"));
        if (permission == null || !jsonUtils.readList(permission.getPermissionsJson(), String.class).contains("delete")) {
            throw new BusinessException("无权删除该文档");
        }
    }

    public void ensureCanDeleteFolder(Long folderId, SecurityUser currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new BusinessException("当前登录状态无效");
        }
        if (currentUser.getRole() == UserRole.ADMIN) {
            return;
        }
        FolderPermissionEntity permission = folderPermissionMapper.selectOne(
                new LambdaQueryWrapper<FolderPermissionEntity>()
                        .eq(FolderPermissionEntity::getFolderId, folderId)
                        .eq(FolderPermissionEntity::getUserId, currentUser.getId())
                        .last("limit 1"));
        if (permission == null || !jsonUtils.readList(permission.getPermissionsJson(), String.class).contains("delete")) {
            throw new BusinessException("无权删除该目录");
        }
    }

    private List<AccessControlEntryDto> buildDtos(List<RawPermission> permissions) {
        Set<Long> userIds = permissions.stream().map(RawPermission::getUserId).collect(Collectors.toSet());
        Map<Long, UserEntity> userMap = userIds.isEmpty()
                ? Collections.<Long, UserEntity>emptyMap()
                : userMapper.selectBatchIds(userIds).stream().collect(Collectors.toMap(UserEntity::getId, item -> item));
        return permissions.stream()
                .map(permission -> {
                    UserEntity user = userMap.get(permission.getUserId());
                    return AccessControlEntryDto.builder()
                            .userId(permission.getUserId())
                            .userName(user == null ? "未知用户" : user.getDisplayName())
                            .role(UserRole.valueOf(permission.getRoleCode()))
                            .permissions(jsonUtils.readList(permission.getPermissionsJson(), String.class))
                            .inheritedFrom(permission.getInheritedFrom())
                            .build();
                })
                .collect(Collectors.toList());
    }

    private List<String> defaultDocumentPermissions(String roleCode, boolean operator) {
        if (UserRole.ADMIN.name().equals(roleCode)) {
            return java.util.Arrays.asList("view", "edit", "upload", "delete", "manage", "correct", "push_rag", "request_audit", "publish", "reject", "create_revision", "lock");
        }
        if (operator) {
            return java.util.Arrays.asList("view", "edit", "upload", "correct", "push_rag", "request_audit");
        }
        return java.util.Arrays.asList("view");
    }

    private List<String> defaultFolderPermissions(String roleCode) {
        if (UserRole.ADMIN.name().equals(roleCode)) {
            return java.util.Arrays.asList("view", "edit", "upload", "delete", "manage");
        }
        return java.util.Arrays.asList("view", "upload");
    }

    @lombok.Builder
    @lombok.Data
    private static class RawPermission {
        private Long userId;
        private String roleCode;
        private String permissionsJson;
        private String inheritedFrom;
    }
}
