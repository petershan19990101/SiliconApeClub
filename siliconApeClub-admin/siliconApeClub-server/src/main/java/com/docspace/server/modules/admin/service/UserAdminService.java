package com.docspace.server.modules.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.admin.dto.AdminUserDto;
import com.docspace.server.modules.admin.dto.RoleOptionDto;
import com.docspace.server.modules.admin.dto.UserResetPasswordRequest;
import com.docspace.server.modules.admin.dto.UserUpsertRequest;
import com.docspace.server.persistence.entity.DepartmentEntity;
import com.docspace.server.persistence.entity.SysRoleEntity;
import com.docspace.server.persistence.entity.SysUserRoleEntity;
import com.docspace.server.persistence.entity.UserEntity;
import com.docspace.server.persistence.mapper.DepartmentMapper;
import com.docspace.server.persistence.mapper.SysRoleMapper;
import com.docspace.server.persistence.mapper.SysUserRoleMapper;
import com.docspace.server.persistence.mapper.UserMapper;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserAdminService {

    private final UserMapper userMapper;
    private final DepartmentMapper departmentMapper;
    private final SysRoleMapper sysRoleMapper;
    private final SysUserRoleMapper sysUserRoleMapper;
    private final PermissionAuditService permissionAuditService;
    private final PasswordEncoder passwordEncoder;
    private final RbacPermissionService rbacPermissionService;

    public List<AdminUserDto> listUsers() {
        List<SysRoleEntity> roles = sysRoleMapper.selectList(new LambdaQueryWrapper<SysRoleEntity>());
        java.util.Map<Long, SysRoleEntity> roleMap = roles.stream().collect(Collectors.toMap(SysRoleEntity::getId, item -> item));
        return userMapper.selectList(new LambdaQueryWrapper<UserEntity>().orderByAsc(UserEntity::getId))
                .stream()
                .map(user -> toDto(user, roleMap))
                .collect(Collectors.toList());
    }

    @Transactional(rollbackFor = Exception.class)
    public AdminUserDto create(UserUpsertRequest request, SecurityUser operator) {
        validateDepartment(request.getDepartmentId());
        ensureUsernameUnique(request.getUsername(), null);
        UserEntity user = new UserEntity();
        user.setUsername(request.getUsername().trim());
        user.setDisplayName(request.getDisplayName().trim());
        user.setEmail(request.getEmail().trim());
        user.setDepartmentId(request.getDepartmentId());
        user.setEnabled(request.getEnabled() ? 1 : 0);
        user.setRoleCode("MEMBER");
        user.setPasswordHash(passwordEncoder.encode(request.getPassword() == null || request.getPassword().trim().isEmpty() ? "Member@123" : request.getPassword().trim()));
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);
        bindRoles(user.getId(), Collections.singletonList(2L));
        permissionAuditService.record("USER", user.getId(), user.getDisplayName(), "CREATE", operator, new HashMap<String, Object>() {{
            put("username", user.getUsername());
            put("enabled", user.getEnabled());
        }});
        return listUsers().stream().filter(item -> item.getId().equals(user.getId())).findFirst().orElseThrow(() -> new BusinessException("用户创建失败"));
    }

    @Transactional(rollbackFor = Exception.class)
    public AdminUserDto update(Long userId, UserUpsertRequest request, SecurityUser operator) {
        UserEntity user = getRequiredUser(userId);
        validateDepartment(request.getDepartmentId());
        ensureUsernameUnique(request.getUsername(), userId);
        user.setUsername(request.getUsername().trim());
        user.setDisplayName(request.getDisplayName().trim());
        user.setEmail(request.getEmail().trim());
        user.setDepartmentId(request.getDepartmentId());
        user.setEnabled(request.getEnabled() ? 1 : 0);
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
        permissionAuditService.record("USER", user.getId(), user.getDisplayName(), "UPDATE", operator, new HashMap<String, Object>() {{
            put("username", user.getUsername());
            put("enabled", user.getEnabled());
        }});
        return listUsers().stream().filter(item -> item.getId().equals(userId)).findFirst().orElseThrow(() -> new BusinessException("用户更新失败"));
    }

    @Transactional(rollbackFor = Exception.class)
    public void enable(Long userId, SecurityUser operator) {
        UserEntity user = getRequiredUser(userId);
        user.setEnabled(1);
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
        permissionAuditService.record("USER", user.getId(), user.getDisplayName(), "ENABLE", operator, Collections.<String, Object>emptyMap());
    }

    @Transactional(rollbackFor = Exception.class)
    public void disable(Long userId, SecurityUser operator) {
        if (operator.getId().equals(userId)) {
            throw new BusinessException("当前登录用户不能停用自己");
        }
        UserEntity user = getRequiredUser(userId);
        ensureAdminUserCoverageAfterDisable(userId);
        user.setEnabled(0);
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
        permissionAuditService.record("USER", user.getId(), user.getDisplayName(), "DISABLE", operator, Collections.<String, Object>emptyMap());
    }

    @Transactional(rollbackFor = Exception.class)
    public void updateRoles(Long userId, List<Long> roleIds, SecurityUser operator) {
        UserEntity user = getRequiredUser(userId);
        if (roleIds == null || roleIds.isEmpty()) {
            throw new BusinessException("用户至少需要绑定一个角色");
        }
        ensureRolesExist(roleIds);
        ensureAdminUserCoverageAfterRoleChange(userId, roleIds, operator);
        sysUserRoleMapper.delete(new QueryWrapper<SysUserRoleEntity>().eq("user_id", userId));
        bindRoles(userId, roleIds);
        syncPrimaryRole(userId);
        permissionAuditService.record("USER", user.getId(), user.getDisplayName(), "UPDATE_ROLE", operator, new HashMap<String, Object>() {{
            put("roleIds", roleIds);
        }});
    }

    @Transactional(rollbackFor = Exception.class)
    public void resetPassword(Long userId, UserResetPasswordRequest request, SecurityUser operator) {
        UserEntity user = getRequiredUser(userId);
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword().trim()));
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
        permissionAuditService.record("USER", user.getId(), user.getDisplayName(), "RESET_PASSWORD", operator, Collections.<String, Object>emptyMap());
    }

    private AdminUserDto toDto(UserEntity user, java.util.Map<Long, SysRoleEntity> roleMap) {
        DepartmentEntity department = departmentMapper.selectById(user.getDepartmentId());
        List<RoleOptionDto> roles = sysUserRoleMapper.selectList(new LambdaQueryWrapper<SysUserRoleEntity>().eq(SysUserRoleEntity::getUserId, user.getId()))
                .stream()
                .map(item -> roleMap.get(item.getRoleId()))
                .filter(java.util.Objects::nonNull)
                .map(rbacPermissionService::toRoleOption)
                .collect(Collectors.toList());
        return AdminUserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .departmentId(user.getDepartmentId())
                .departmentName(department == null ? null : department.getName())
                .enabled(user.getEnabled() != null && user.getEnabled() == 1)
                .primaryRoleCode(user.getRoleCode())
                .roles(roles)
                .build();
    }

    private void validateDepartment(Long departmentId) {
        if (departmentId == null || departmentMapper.selectById(departmentId) == null) {
            throw new BusinessException("所属部门不存在");
        }
    }

    private void ensureUsernameUnique(String username, Long userId) {
        UserEntity duplicate = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getUsername, username.trim())
                .ne(userId != null, UserEntity::getId, userId)
                .last("limit 1"));
        if (duplicate != null) {
            throw new BusinessException("用户名已存在: " + username);
        }
    }

    private UserEntity getRequiredUser(Long userId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException("用户不存在: " + userId);
        }
        return user;
    }

    private void ensureRolesExist(List<Long> roleIds) {
        long count = sysRoleMapper.selectCount(new LambdaQueryWrapper<SysRoleEntity>().in(SysRoleEntity::getId, new LinkedHashSet<Long>(roleIds)));
        if (count != new LinkedHashSet<Long>(roleIds).size()) {
            throw new BusinessException("包含不存在的角色");
        }
    }

    private void ensureAdminUserCoverageAfterDisable(Long targetUserId) {
        List<UserEntity> enabledUsers = userMapper.selectList(new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getEnabled, 1));
        long remainingAdminUsers = enabledUsers.stream()
                .filter(user -> !user.getId().equals(targetUserId))
                .filter(user -> hasAdminRole(user.getId(), null))
                .count();
        if (remainingAdminUsers == 0) {
            throw new BusinessException("系统至少需要保留一个启用的管理员账号");
        }
    }

    private void ensureAdminUserCoverageAfterRoleChange(Long userId, List<Long> nextRoleIds, SecurityUser operator) {
        boolean targetWillBeAdmin = hasAdminRole(null, new LinkedHashSet<Long>(nextRoleIds));
        if (operator.getId().equals(userId) && !targetWillBeAdmin) {
            throw new BusinessException("当前登录用户不能移除自己的全部管理员权限");
        }

        List<UserEntity> enabledUsers = userMapper.selectList(new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getEnabled, 1));
        long adminUsers = enabledUsers.stream().filter(user -> {
            if (user.getId().equals(userId)) {
                return targetWillBeAdmin;
            }
            return hasAdminRole(user.getId(), null);
        }).count();
        if (adminUsers == 0) {
            throw new BusinessException("系统至少需要保留一个启用的管理员账号");
        }
    }

    private boolean hasAdminRole(Long userId, Set<Long> roleIdsOverride) {
        Set<Long> roleIds = roleIdsOverride;
        if (roleIds == null) {
            roleIds = sysUserRoleMapper.selectList(new LambdaQueryWrapper<SysUserRoleEntity>().eq(SysUserRoleEntity::getUserId, userId))
                    .stream()
                    .map(SysUserRoleEntity::getRoleId)
                    .collect(Collectors.toSet());
        }
        if (roleIds.isEmpty()) {
            return false;
        }
        return sysRoleMapper.selectCount(new LambdaQueryWrapper<SysRoleEntity>()
                .in(SysRoleEntity::getId, roleIds)
                .eq(SysRoleEntity::getEnabled, 1)
                .eq(SysRoleEntity::getAdminRole, 1)) > 0;
    }

    private void bindRoles(Long userId, List<Long> roleIds) {
        for (Long roleId : new LinkedHashSet<Long>(roleIds)) {
            SysUserRoleEntity relation = new SysUserRoleEntity();
            relation.setUserId(userId);
            relation.setRoleId(roleId);
            relation.setCreatedAt(LocalDateTime.now());
            relation.setUpdatedAt(LocalDateTime.now());
            sysUserRoleMapper.insert(relation);
        }
        syncPrimaryRole(userId);
    }

    private void syncPrimaryRole(Long userId) {
        UserEntity user = getRequiredUser(userId);
        List<SysRoleEntity> roles = sysRoleMapper.selectList(new LambdaQueryWrapper<SysRoleEntity>()
                .in(SysRoleEntity::getId, sysUserRoleMapper.selectList(new LambdaQueryWrapper<SysUserRoleEntity>().eq(SysUserRoleEntity::getUserId, userId))
                        .stream()
                        .map(SysUserRoleEntity::getRoleId)
                        .collect(Collectors.toList())));
        String roleCode = roles.stream().anyMatch(role -> role.getAdminRole() != null && role.getAdminRole() == 1) ? "ADMIN" : "MEMBER";
        user.setRoleCode(roleCode);
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
    }
}
