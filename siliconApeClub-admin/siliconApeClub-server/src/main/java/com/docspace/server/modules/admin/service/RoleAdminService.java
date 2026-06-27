package com.docspace.server.modules.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.admin.dto.RoleDto;
import com.docspace.server.modules.admin.dto.RoleUpsertRequest;
import com.docspace.server.persistence.entity.SysRoleEntity;
import com.docspace.server.persistence.entity.SysRolePermissionEntity;
import com.docspace.server.persistence.entity.SysUserRoleEntity;
import com.docspace.server.persistence.entity.UserEntity;
import com.docspace.server.persistence.mapper.SysRoleMapper;
import com.docspace.server.persistence.mapper.SysRolePermissionMapper;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RoleAdminService {

    private final SysRoleMapper sysRoleMapper;
    private final SysUserRoleMapper sysUserRoleMapper;
    private final SysRolePermissionMapper sysRolePermissionMapper;
    private final UserMapper userMapper;
    private final PermissionAuditService permissionAuditService;

    public List<RoleDto> listRoles() {
        List<SysRoleEntity> roles = sysRoleMapper.selectList(new LambdaQueryWrapper<SysRoleEntity>().orderByAsc(SysRoleEntity::getId));
        return roles.stream().map(this::toDto).collect(Collectors.toList());
    }

    public Set<Long> getPermissionIds(Long roleId) {
        getRequiredRole(roleId);
        return new LinkedHashSet<Long>(sysRolePermissionMapper.selectList(new LambdaQueryWrapper<SysRolePermissionEntity>()
                        .eq(SysRolePermissionEntity::getRoleId, roleId))
                .stream()
                .map(SysRolePermissionEntity::getMenuId)
                .collect(Collectors.toList()));
    }

    @Transactional(rollbackFor = Exception.class)
    public RoleDto create(RoleUpsertRequest request, SecurityUser operator) {
        validateRoleRequest(request, null);
        SysRoleEntity entity = new SysRoleEntity();
        fillEntity(entity, request);
        entity.setBuiltIn(0);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        sysRoleMapper.insert(entity);
        permissionAuditService.record("ROLE", entity.getId(), entity.getName(), "CREATE", operator, new HashMap<String, Object>() {{
            put("code", entity.getCode());
            put("adminRole", entity.getAdminRole());
        }});
        return toDto(entity);
    }

    @Transactional(rollbackFor = Exception.class)
    public RoleDto update(Long roleId, RoleUpsertRequest request, SecurityUser operator) {
        SysRoleEntity entity = getRequiredRole(roleId);
        validateRoleRequest(request, roleId);
        ensureRoleSafeguards(roleId, request.getEnabled(), request.getAdminRole());
        fillEntity(entity, request);
        entity.setUpdatedAt(LocalDateTime.now());
        sysRoleMapper.updateById(entity);
        permissionAuditService.record("ROLE", entity.getId(), entity.getName(), "UPDATE", operator, new HashMap<String, Object>() {{
            put("code", entity.getCode());
            put("enabled", entity.getEnabled());
            put("adminRole", entity.getAdminRole());
        }});
        syncPrimaryRoleCodes();
        return toDto(entity);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long roleId, SecurityUser operator) {
        SysRoleEntity entity = getRequiredRole(roleId);
        ensureRoleDeletionAllowed(roleId);
        sysRolePermissionMapper.delete(new QueryWrapper<SysRolePermissionEntity>().eq("role_id", roleId));
        sysUserRoleMapper.delete(new QueryWrapper<SysUserRoleEntity>().eq("role_id", roleId));
        sysRoleMapper.deleteById(roleId);
        permissionAuditService.record("ROLE", roleId, entity.getName(), "DELETE", operator, Collections.<String, Object>emptyMap());
        syncPrimaryRoleCodes();
    }

    @Transactional(rollbackFor = Exception.class)
    public void updatePermissions(Long roleId, List<Long> menuIds, SecurityUser operator) {
        SysRoleEntity role = getRequiredRole(roleId);
        sysRolePermissionMapper.delete(new QueryWrapper<SysRolePermissionEntity>().eq("role_id", roleId));
        for (Long menuId : new LinkedHashSet<Long>(menuIds)) {
            SysRolePermissionEntity entity = new SysRolePermissionEntity();
            entity.setRoleId(roleId);
            entity.setMenuId(menuId);
            entity.setCreatedAt(LocalDateTime.now());
            entity.setUpdatedAt(LocalDateTime.now());
            sysRolePermissionMapper.insert(entity);
        }
        permissionAuditService.record("ROLE", roleId, role.getName(), "UPDATE_PERMISSION", operator, new HashMap<String, Object>() {{
            put("menuIds", menuIds);
        }});
    }

    public SysRoleEntity getRequiredRole(Long roleId) {
        SysRoleEntity entity = sysRoleMapper.selectById(roleId);
        if (entity == null) {
            throw new BusinessException("角色不存在: " + roleId);
        }
        return entity;
    }

    public RoleDto toDto(SysRoleEntity entity) {
        int memberCount = sysUserRoleMapper.selectCount(new LambdaQueryWrapper<SysUserRoleEntity>().eq(SysUserRoleEntity::getRoleId, entity.getId())).intValue();
        return RoleDto.builder()
                .id(entity.getId())
                .code(entity.getCode())
                .name(entity.getName())
                .description(entity.getDescription())
                .enabled(entity.getEnabled() != null && entity.getEnabled() == 1)
                .builtIn(entity.getBuiltIn() != null && entity.getBuiltIn() == 1)
                .adminRole(entity.getAdminRole() != null && entity.getAdminRole() == 1)
                .memberCount(memberCount)
                .build();
    }

    private void fillEntity(SysRoleEntity entity, RoleUpsertRequest request) {
        entity.setCode(request.getCode().trim());
        entity.setName(request.getName().trim());
        entity.setDescription(request.getDescription());
        entity.setEnabled(request.getEnabled() ? 1 : 0);
        entity.setAdminRole(request.getAdminRole() ? 1 : 0);
    }

    private void validateRoleRequest(RoleUpsertRequest request, Long currentId) {
        SysRoleEntity duplicate = sysRoleMapper.selectOne(new LambdaQueryWrapper<SysRoleEntity>()
                .eq(SysRoleEntity::getCode, request.getCode().trim())
                .ne(currentId != null, SysRoleEntity::getId, currentId)
                .last("limit 1"));
        if (duplicate != null) {
            throw new BusinessException("角色编码已存在: " + request.getCode());
        }
    }

    private void ensureRoleDeletionAllowed(Long roleId) {
        ensureRoleSafeguards(roleId, false, false);
    }

    private void ensureRoleSafeguards(Long targetRoleId, Boolean enabled, Boolean adminRole) {
        List<SysRoleEntity> roles = sysRoleMapper.selectList(new LambdaQueryWrapper<SysRoleEntity>());
        List<SysRoleEntity> afterRoles = new ArrayList<SysRoleEntity>();
        for (SysRoleEntity role : roles) {
            if (role.getId().equals(targetRoleId)) {
                if (enabled == null && adminRole == null) {
                    continue;
                }
                role.setEnabled(enabled != null && enabled ? 1 : 0);
                role.setAdminRole(adminRole != null && adminRole ? 1 : 0);
            }
            if (enabled == null && adminRole == null && role.getId().equals(targetRoleId)) {
                continue;
            }
            afterRoles.add(role);
        }

        long enabledAdminRoleCount = afterRoles.stream().filter(role -> role.getEnabled() == 1 && role.getAdminRole() == 1).count();
        if (enabledAdminRoleCount == 0) {
            throw new BusinessException("系统至少需要保留一个启用的管理员角色");
        }

        Set<Long> enabledAdminRoleIds = afterRoles.stream()
                .filter(role -> role.getEnabled() == 1 && role.getAdminRole() == 1)
                .map(SysRoleEntity::getId)
                .collect(Collectors.toSet());

        List<UserEntity> enabledUsers = userMapper.selectList(new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getEnabled, 1));
        long enabledAdminUserCount = enabledUsers.stream().filter(user -> hasAnyRole(user.getId(), enabledAdminRoleIds)).count();
        if (enabledAdminUserCount == 0) {
            throw new BusinessException("系统至少需要保留一个启用的管理员账号");
        }
    }

    private boolean hasAnyRole(Long userId, Set<Long> roleIds) {
        if (roleIds.isEmpty()) {
            return false;
        }
        return sysUserRoleMapper.selectCount(new LambdaQueryWrapper<SysUserRoleEntity>()
                .eq(SysUserRoleEntity::getUserId, userId)
                .in(SysUserRoleEntity::getRoleId, roleIds)) > 0;
    }

    private void syncPrimaryRoleCodes() {
        List<UserEntity> users = userMapper.selectList(new LambdaQueryWrapper<UserEntity>());
        List<SysRoleEntity> roles = sysRoleMapper.selectList(new LambdaQueryWrapper<SysRoleEntity>());
        java.util.Map<Long, SysRoleEntity> roleMap = roles.stream().collect(Collectors.toMap(SysRoleEntity::getId, item -> item));
        for (UserEntity user : users) {
            List<SysRoleEntity> userRoles = sysUserRoleMapper.selectList(new LambdaQueryWrapper<SysUserRoleEntity>().eq(SysUserRoleEntity::getUserId, user.getId()))
                    .stream()
                    .map(item -> roleMap.get(item.getRoleId()))
                    .filter(java.util.Objects::nonNull)
                    .collect(Collectors.toList());
            String primaryRoleCode = userRoles.stream().anyMatch(role -> role.getAdminRole() == 1) ? "ADMIN" : "MEMBER";
            user.setRoleCode(primaryRoleCode);
            user.setUpdatedAt(LocalDateTime.now());
            userMapper.updateById(user);
        }
    }
}
