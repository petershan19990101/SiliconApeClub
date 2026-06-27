/**
 * UserQueryService 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.docspace.server.common.enums.UserRole;
import com.docspace.server.modules.admin.service.RbacPermissionService;
import com.docspace.server.persistence.entity.DepartmentEntity;
import com.docspace.server.persistence.entity.UserEntity;
import com.docspace.server.persistence.mapper.DepartmentMapper;
import com.docspace.server.persistence.mapper.UserMapper;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserQueryService {

    private final UserMapper userMapper;
    private final DepartmentMapper departmentMapper;
    private final RbacPermissionService rbacPermissionService;

    public List<UserSummaryDto> listUsers() {
        return userMapper.selectList(new LambdaQueryWrapper<UserEntity>().orderByAsc(UserEntity::getId))
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public UserSummaryDto getById(Long id) {
        UserEntity entity = userMapper.selectById(id);
        return entity == null ? null : toDto(entity);
    }

    private UserSummaryDto toDto(UserEntity entity) {
        DepartmentEntity department = entity.getDepartmentId() == null ? null : departmentMapper.selectById(entity.getDepartmentId());
        UserRole role = UserRole.valueOf(entity.getRoleCode());
        return UserSummaryDto.builder()
                .id(entity.getId())
                .username(entity.getUsername())
                .name(entity.getDisplayName())
                .email(entity.getEmail())
                .role(role)
                .departmentId(entity.getDepartmentId())
                .departmentName(department == null ? null : department.getName())
                .permissions(defaultPermissions(role))
                .roles(rbacPermissionService.getRoleOptionsForUser(entity.getId()))
                .menus(rbacPermissionService.getVisibleMenuTree(entity.getId()))
                .buttonPermissions(rbacPermissionService.getButtonPermissions(entity.getId()).stream().collect(Collectors.toList()))
                .build();
    }

    private List<String> defaultPermissions(UserRole role) {
        if (role == UserRole.ADMIN) {
            return Arrays.asList("view", "edit", "upload", "delete", "manage", "correct", "push_rag", "request_audit", "publish", "reject", "create_revision", "lock");
        }
        return Arrays.asList("view", "edit", "upload", "correct", "push_rag", "request_audit");
    }
}
