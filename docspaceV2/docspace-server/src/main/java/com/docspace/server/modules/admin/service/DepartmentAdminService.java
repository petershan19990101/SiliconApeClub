package com.docspace.server.modules.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.admin.dto.AdminDepartmentDto;
import com.docspace.server.modules.admin.dto.DepartmentDeleteCheckDto;
import com.docspace.server.modules.admin.dto.DepartmentUpsertRequest;
import com.docspace.server.persistence.entity.DepartmentEntity;
import com.docspace.server.persistence.entity.DocumentEntity;
import com.docspace.server.persistence.entity.FolderEntity;
import com.docspace.server.persistence.entity.UserEntity;
import com.docspace.server.persistence.mapper.DepartmentMapper;
import com.docspace.server.persistence.mapper.DocumentMapper;
import com.docspace.server.persistence.mapper.FolderMapper;
import com.docspace.server.persistence.mapper.UserMapper;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DepartmentAdminService {

    private final DepartmentMapper departmentMapper;
    private final UserMapper userMapper;
    private final FolderMapper folderMapper;
    private final DocumentMapper documentMapper;
    private final PermissionAuditService permissionAuditService;

    public List<AdminDepartmentDto> listDepartments() {
        return listDepartmentEntities().stream()
                .map(entity -> toDto(entity, Collections.<AdminDepartmentDto>emptyList()))
                .collect(Collectors.toList());
    }

    public List<AdminDepartmentDto> listDepartmentTree() {
        List<DepartmentEntity> departments = listDepartmentEntities();
        Map<Long, AdminDepartmentDto> dtoMap = new LinkedHashMap<>();
        for (DepartmentEntity entity : departments) {
            dtoMap.put(entity.getId(), toDto(entity, new ArrayList<AdminDepartmentDto>()));
        }

        List<AdminDepartmentDto> roots = new ArrayList<>();
        for (DepartmentEntity entity : departments) {
            AdminDepartmentDto current = dtoMap.get(entity.getId());
            if (entity.getParentId() == null) {
                roots.add(current);
                continue;
            }
            AdminDepartmentDto parent = dtoMap.get(entity.getParentId());
            if (parent == null) {
                roots.add(current);
                continue;
            }
            parent.getChildren().add(current);
        }
        return roots;
    }

    @Transactional(rollbackFor = Exception.class)
    public AdminDepartmentDto create(DepartmentUpsertRequest request, SecurityUser operator) {
        validateRequest(request, null);
        DepartmentEntity entity = new DepartmentEntity();
        fillEntity(entity, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        departmentMapper.insert(entity);
        permissionAuditService.record("DEPARTMENT", entity.getId(), entity.getName(), "CREATE", operator,
                Collections.<String, Object>singletonMap("parentId", entity.getParentId()));
        return toDto(entity, Collections.<AdminDepartmentDto>emptyList());
    }

    @Transactional(rollbackFor = Exception.class)
    public AdminDepartmentDto update(Long departmentId, DepartmentUpsertRequest request, SecurityUser operator) {
        DepartmentEntity entity = getRequiredDepartment(departmentId);
        Long beforeParentId = entity.getParentId();
        validateRequest(request, departmentId);
        LocalDateTime now = LocalDateTime.now();
        String trimmedName = request.getName().trim();

        LambdaUpdateWrapper<DepartmentEntity> updateWrapper = new LambdaUpdateWrapper<DepartmentEntity>()
                .eq(DepartmentEntity::getId, departmentId)
                .set(DepartmentEntity::getParentId, request.getParentId())
                .set(DepartmentEntity::getName, trimmedName)
                .set(DepartmentEntity::getUpdatedAt, now);
        departmentMapper.update(null, updateWrapper);

        entity.setParentId(request.getParentId());
        entity.setName(trimmedName);
        entity.setUpdatedAt(now);

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("beforeParentId", beforeParentId);
        detail.put("afterParentId", entity.getParentId());
        permissionAuditService.record("DEPARTMENT", entity.getId(), entity.getName(), "UPDATE", operator, detail);
        return toDto(entity, Collections.<AdminDepartmentDto>emptyList());
    }

    public DepartmentDeleteCheckDto getDeleteCheck(Long departmentId) {
        DepartmentEntity entity = getRequiredDepartment(departmentId);
        DepartmentEntity parent = entity.getParentId() == null ? null : departmentMapper.selectById(entity.getParentId());
        return DepartmentDeleteCheckDto.builder()
                .departmentId(entity.getId())
                .departmentName(entity.getName())
                .parentId(entity.getParentId())
                .parentName(parent == null ? null : parent.getName())
                .childDepartmentCount(countChildDepartments(departmentId))
                .userCount(countUsers(departmentId))
                .folderCount(countFolders(departmentId))
                .documentCount(countDocuments(departmentId))
                .topLevel(entity.getParentId() == null)
                .build();
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long departmentId, SecurityUser operator) {
        DepartmentEntity entity = getRequiredDepartment(departmentId);
        DepartmentDeleteCheckDto deleteCheck = getDeleteCheck(departmentId);

        if (Boolean.TRUE.equals(deleteCheck.getTopLevel())) {
            boolean emptyTree = deleteCheck.getChildDepartmentCount() == 0
                    && deleteCheck.getUserCount() == 0
                    && deleteCheck.getFolderCount() == 0
                    && deleteCheck.getDocumentCount() == 0;
            if (!emptyTree) {
                throw new BusinessException("顶层部门仅可在整棵树为空时删除");
            }
            departmentMapper.deleteById(departmentId);
            permissionAuditService.record("DEPARTMENT", departmentId, entity.getName(), "DELETE", operator, Collections.<String, Object>emptyMap());
            return;
        }

        Long parentId = entity.getParentId();
        LocalDateTime now = LocalDateTime.now();

        List<DepartmentEntity> childDepartments = departmentMapper.selectList(new LambdaQueryWrapper<DepartmentEntity>()
                .eq(DepartmentEntity::getParentId, departmentId)
                .orderByAsc(DepartmentEntity::getId));
        for (DepartmentEntity child : childDepartments) {
            child.setParentId(parentId);
            child.setUpdatedAt(now);
            departmentMapper.updateById(child);
        }

        List<UserEntity> users = userMapper.selectList(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getDepartmentId, departmentId)
                .orderByAsc(UserEntity::getId));
        for (UserEntity user : users) {
            user.setDepartmentId(parentId);
            user.setUpdatedAt(now);
            userMapper.updateById(user);
        }

        List<FolderEntity> folders = folderMapper.selectList(new LambdaQueryWrapper<FolderEntity>()
                .eq(FolderEntity::getDepartmentId, departmentId)
                .eq(FolderEntity::getDeleted, 0)
                .orderByAsc(FolderEntity::getId));
        for (FolderEntity folder : folders) {
            folder.setDepartmentId(parentId);
            folder.setUpdatedAt(now);
            folderMapper.updateById(folder);
        }

        List<DocumentEntity> documents = documentMapper.selectList(new LambdaQueryWrapper<DocumentEntity>()
                .eq(DocumentEntity::getDepartmentId, departmentId)
                .eq(DocumentEntity::getDeleted, 0)
                .orderByAsc(DocumentEntity::getId));
        for (DocumentEntity document : documents) {
            document.setDepartmentId(parentId);
            document.setUpdatedAt(now);
            documentMapper.updateById(document);
        }

        departmentMapper.deleteById(departmentId);
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("parentId", parentId);
        detail.put("childDepartmentCount", childDepartments.size());
        detail.put("userCount", users.size());
        detail.put("folderCount", folders.size());
        detail.put("documentCount", documents.size());
        permissionAuditService.record("DEPARTMENT", departmentId, entity.getName(), "DELETE", operator, detail);
    }

    private List<DepartmentEntity> listDepartmentEntities() {
        return departmentMapper.selectList(new LambdaQueryWrapper<DepartmentEntity>()
                .orderByAsc(DepartmentEntity::getParentId)
                .orderByAsc(DepartmentEntity::getId));
    }

    private void fillEntity(DepartmentEntity entity, DepartmentUpsertRequest request) {
        entity.setParentId(request.getParentId());
        entity.setName(request.getName().trim());
    }

    private void validateRequest(DepartmentUpsertRequest request, Long currentId) {
        if (request.getParentId() == null) {
            return;
        }
        DepartmentEntity parent = departmentMapper.selectById(request.getParentId());
        if (parent == null) {
            throw new BusinessException("上级部门不存在");
        }
        if (currentId != null && currentId.equals(request.getParentId())) {
            throw new BusinessException("部门不能设置自己为上级");
        }
        if (currentId != null && isDescendant(request.getParentId(), currentId)) {
            throw new BusinessException("不能将部门移动到自己的下级部门下");
        }
    }

    private boolean isDescendant(Long candidateParentId, Long currentId) {
        Map<Long, DepartmentEntity> departmentMap = listDepartmentEntities().stream()
                .collect(Collectors.toMap(DepartmentEntity::getId, item -> item, (left, right) -> left, LinkedHashMap::new));
        Long nextId = candidateParentId;
        while (nextId != null) {
            if (currentId.equals(nextId)) {
                return true;
            }
            DepartmentEntity current = departmentMap.get(nextId);
            if (current == null) {
                return false;
            }
            nextId = current.getParentId();
        }
        return false;
    }

    private int countChildDepartments(Long departmentId) {
        return Math.toIntExact(departmentMapper.selectCount(new LambdaQueryWrapper<DepartmentEntity>()
                .eq(DepartmentEntity::getParentId, departmentId)));
    }

    private int countUsers(Long departmentId) {
        return Math.toIntExact(userMapper.selectCount(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getDepartmentId, departmentId)));
    }

    private int countFolders(Long departmentId) {
        return Math.toIntExact(folderMapper.selectCount(new LambdaQueryWrapper<FolderEntity>()
                .eq(FolderEntity::getDepartmentId, departmentId)
                .eq(FolderEntity::getDeleted, 0)));
    }

    private int countDocuments(Long departmentId) {
        return Math.toIntExact(documentMapper.selectCount(new LambdaQueryWrapper<DocumentEntity>()
                .eq(DocumentEntity::getDepartmentId, departmentId)
                .eq(DocumentEntity::getDeleted, 0)));
    }

    private DepartmentEntity getRequiredDepartment(Long departmentId) {
        DepartmentEntity entity = departmentMapper.selectById(departmentId);
        if (entity == null) {
            throw new BusinessException("部门不存在: " + departmentId);
        }
        return entity;
    }

    private AdminDepartmentDto toDto(DepartmentEntity entity, List<AdminDepartmentDto> children) {
        return AdminDepartmentDto.builder()
                .id(entity.getId())
                .parentId(entity.getParentId())
                .name(entity.getName())
                .children(children)
                .build();
    }
}
