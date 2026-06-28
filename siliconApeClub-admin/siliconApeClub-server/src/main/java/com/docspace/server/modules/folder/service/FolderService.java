/**
 * FolderService 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.folder.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.docspace.server.common.enums.UserRole;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.document.dto.PermissionUpdateRequest;
import com.docspace.server.modules.document.service.PermissionSupportService;
import com.docspace.server.modules.folder.dto.CreateFolderRequest;
import com.docspace.server.modules.folder.dto.FolderDeleteCheckDto;
import com.docspace.server.modules.folder.dto.FolderDto;
import com.docspace.server.persistence.entity.DepartmentEntity;
import com.docspace.server.persistence.entity.DocumentEntity;
import com.docspace.server.persistence.entity.FolderEntity;
import com.docspace.server.persistence.mapper.DepartmentMapper;
import com.docspace.server.persistence.mapper.DocumentMapper;
import com.docspace.server.persistence.mapper.FolderMapper;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FolderService {

    private final FolderMapper folderMapper;
    private final DocumentMapper documentMapper;
    private final DepartmentMapper departmentMapper;
    private final PermissionSupportService permissionSupportService;

    /**
     * 按部门或父目录筛选目录列表。
     */
    public List<FolderDto> listFolders(Long departmentId, Long parentId) {
        LambdaQueryWrapper<FolderEntity> wrapper = new LambdaQueryWrapper<FolderEntity>()
                .eq(FolderEntity::getDeleted, 0)
                .orderByAsc(FolderEntity::getId);
        if (departmentId != null) {
            wrapper.eq(FolderEntity::getDepartmentId, departmentId);
        }
        if (parentId != null) {
            wrapper.eq(FolderEntity::getParentId, parentId);
        }
        return folderMapper.selectList(wrapper).stream().map(this::toDto).collect(Collectors.toList());
    }

    /**
     * 创建新目录并初始化默认权限。
     */
    @Transactional(rollbackFor = Exception.class)
    public FolderDto createFolder(CreateFolderRequest request, SecurityUser currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new BusinessException("当前登录状态无效，无法创建文件夹");
        }
        if (currentUser.getDepartmentId() == null) {
            throw new BusinessException("当前用户未绑定所属部门，无法创建文件夹");
        }
        Long targetDepartmentId = resolveTargetDepartmentId(request, currentUser);
        if (request.getParentId() != null) {
            FolderEntity parentFolder = getRequiredFolder(request.getParentId());
            if (!isSameOrDescendantDepartment(targetDepartmentId, parentFolder.getDepartmentId())) {
                throw new BusinessException("子文件夹所属部门必须是父文件夹部门或其下级部门");
            }
        }

        FolderEntity entity = new FolderEntity();
        entity.setName(request.getName().trim());
        entity.setDepartmentId(targetDepartmentId);
        entity.setParentId(request.getParentId());
        entity.setCreatedBy(currentUser.getId());
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        folderMapper.insert(entity);
        permissionSupportService.seedDefaultFolderPermissions(entity.getId(), entity.getDepartmentId());
        return toDto(entity);
    }

    public FolderDeleteCheckDto checkDeletion(Long id) {
        FolderEntity folder = getRequiredFolder(id);
        int childFolderCount = Math.toIntExact(folderMapper.selectCount(new LambdaQueryWrapper<FolderEntity>()
                .eq(FolderEntity::getDeleted, 0)
                .eq(FolderEntity::getParentId, id)));
        int documentCount = Math.toIntExact(documentMapper.selectCount(new LambdaQueryWrapper<DocumentEntity>()
                .eq(DocumentEntity::getDeleted, 0)
                .eq(DocumentEntity::getFolderId, id)));
        return FolderDeleteCheckDto.builder()
                .folderId(folder.getId())
                .folderName(folder.getName())
                .empty(childFolderCount == 0 && documentCount == 0)
                .childFolderCount(childFolderCount)
                .documentCount(documentCount)
                .build();
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteFolder(Long id, SecurityUser currentUser) {
        permissionSupportService.ensureCanDeleteFolder(id, currentUser);
        FolderDeleteCheckDto check = checkDeletion(id);
        if (!check.isEmpty()) {
            throw new BusinessException("当前目录下仍有子目录或文档，不能删除");
        }
        FolderEntity folder = getRequiredFolder(id);
        folder.setDeleted(1);
        folder.setUpdatedAt(LocalDateTime.now());
        folderMapper.updateById(folder);
    }

    /**
     * 覆盖保存目录权限配置。
     */
    @Transactional(rollbackFor = Exception.class)
    public void updatePermissions(Long id, PermissionUpdateRequest request) {
        permissionSupportService.replaceFolderPermissions(id, request.getAccessControl());
    }

    private FolderDto toDto(FolderEntity entity) {
        return FolderDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .departmentId(entity.getDepartmentId())
                .parentId(entity.getParentId())
                .createdAt(entity.getCreatedAt())
                .accessControl(permissionSupportService.listFolderPermissions(entity.getId()))
                .build();
    }

    private FolderEntity getRequiredFolder(Long id) {
        FolderEntity folder = folderMapper.selectById(id);
        if (folder == null || folder.getDeleted() != null && folder.getDeleted() == 1) {
            throw new BusinessException("目录不存在: " + id);
        }
        return folder;
    }

    private Long resolveTargetDepartmentId(CreateFolderRequest request, SecurityUser currentUser) {
        Long targetDepartmentId = request.getDepartmentId();
        if (targetDepartmentId == null && request.getParentId() != null) {
            targetDepartmentId = getRequiredFolder(request.getParentId()).getDepartmentId();
        }
        if (targetDepartmentId == null) {
            targetDepartmentId = currentUser.getDepartmentId();
        }
        DepartmentEntity department = departmentMapper.selectById(targetDepartmentId);
        if (department == null) {
            throw new BusinessException("所属部门不存在: " + targetDepartmentId);
        }
        if (currentUser.getRole() != UserRole.ADMIN && !targetDepartmentId.equals(currentUser.getDepartmentId())) {
            throw new BusinessException("只能在本人所属部门下创建文件夹");
        }
        return targetDepartmentId;
    }

    private boolean isSameOrDescendantDepartment(Long candidateDepartmentId, Long ancestorDepartmentId) {
        if (candidateDepartmentId == null || ancestorDepartmentId == null) {
            return false;
        }
        Long nextId = candidateDepartmentId;
        Set<Long> visited = new HashSet<Long>();
        while (nextId != null && visited.add(nextId)) {
            if (nextId.equals(ancestorDepartmentId)) {
                return true;
            }
            DepartmentEntity department = departmentMapper.selectById(nextId);
            if (department == null) {
                return false;
            }
            nextId = department.getParentId();
        }
        return false;
    }
}
