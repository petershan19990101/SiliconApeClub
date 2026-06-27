package com.docspace.server.modules.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.admin.dto.RoleOptionDto;
import com.docspace.server.modules.admin.dto.SystemMenuDto;
import com.docspace.server.persistence.entity.SysMenuEntity;
import com.docspace.server.persistence.entity.SysRoleEntity;
import com.docspace.server.persistence.entity.SysRolePermissionEntity;
import com.docspace.server.persistence.entity.SysUserRoleEntity;
import com.docspace.server.persistence.entity.UserEntity;
import com.docspace.server.persistence.mapper.SysMenuMapper;
import com.docspace.server.persistence.mapper.SysRoleMapper;
import com.docspace.server.persistence.mapper.SysRolePermissionMapper;
import com.docspace.server.persistence.mapper.SysUserRoleMapper;
import com.docspace.server.persistence.mapper.UserMapper;
import com.docspace.server.security.SecurityUser;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RbacPermissionService {

    private final SysMenuMapper sysMenuMapper;
    private final SysRoleMapper sysRoleMapper;
    private final SysUserRoleMapper sysUserRoleMapper;
    private final SysRolePermissionMapper sysRolePermissionMapper;
    private final UserMapper userMapper;

    public void ensurePermission(SecurityUser currentUser, String permissionCode) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new BusinessException("当前登录状态无效");
        }
        if (!hasPermission(currentUser.getId(), permissionCode)) {
            throw new BusinessException("当前账号没有权限执行该操作");
        }
    }

    public boolean hasPermission(Long userId, String permissionCode) {
        return getGrantedCodes(userId).contains(permissionCode);
    }

    public List<RoleOptionDto> getRoleOptionsForUser(Long userId) {
        Map<Long, SysRoleEntity> roleMap = listRolesByIds(getRoleIdsForUser(userId)).stream()
                .collect(Collectors.toMap(SysRoleEntity::getId, item -> item));
        List<RoleOptionDto> roles = new ArrayList<RoleOptionDto>();
        for (Long roleId : getRoleIdsForUser(userId)) {
            SysRoleEntity role = roleMap.get(roleId);
            if (role != null) {
                roles.add(toRoleOption(role));
            }
        }
        return roles;
    }

    public Set<Long> getRoleIdsForUser(Long userId) {
        List<Long> roleIds = sysUserRoleMapper.selectList(new LambdaQueryWrapper<SysUserRoleEntity>()
                        .eq(SysUserRoleEntity::getUserId, userId))
                .stream()
                .map(SysUserRoleEntity::getRoleId)
                .collect(Collectors.toList());
        if (!roleIds.isEmpty()) {
            return new LinkedHashSet<Long>(roleIds);
        }

        UserEntity user = userMapper.selectById(userId);
        if (user == null || user.getRoleCode() == null) {
            return Collections.emptySet();
        }
        SysRoleEntity role = sysRoleMapper.selectOne(new LambdaQueryWrapper<SysRoleEntity>()
                .eq(SysRoleEntity::getCode, user.getRoleCode())
                .last("limit 1"));
        return role == null ? Collections.<Long>emptySet() : new LinkedHashSet<Long>(Collections.singletonList(role.getId()));
    }

    public Set<String> getButtonPermissions(Long userId) {
        return listGrantedMenus(userId).stream()
                .filter(menu -> "action".equals(menu.getType()))
                .map(SysMenuEntity::getCode)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public List<SystemMenuDto> getVisibleMenuTree(Long userId) {
        Set<Long> roleIds = getRoleIdsForUser(userId);
        if (roleIds.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> grantedMenuIds = new LinkedHashSet<Long>(sysRolePermissionMapper.selectList(
                        new LambdaQueryWrapper<SysRolePermissionEntity>().in(SysRolePermissionEntity::getRoleId, roleIds))
                .stream()
                .map(SysRolePermissionEntity::getMenuId)
                .collect(Collectors.toList()));

        List<SysMenuEntity> allMenus = sysMenuMapper.selectList(new LambdaQueryWrapper<SysMenuEntity>()
                .eq(SysMenuEntity::getEnabled, 1)
                .orderByAsc(SysMenuEntity::getSortOrder)
                .orderByAsc(SysMenuEntity::getId));

        Map<Long, SysMenuEntity> menuMap = allMenus.stream().collect(Collectors.toMap(SysMenuEntity::getId, item -> item));
        Set<Long> visibleIds = new LinkedHashSet<Long>();
        for (Long menuId : grantedMenuIds) {
            SysMenuEntity menu = menuMap.get(menuId);
            if (menu == null || "action".equals(menu.getType())) {
                continue;
            }
            visibleIds.add(menu.getId());
            Long parentId = menu.getParentId();
            while (parentId != null) {
                SysMenuEntity parent = menuMap.get(parentId);
                if (parent == null || "action".equals(parent.getType())) {
                    break;
                }
                visibleIds.add(parent.getId());
                parentId = parent.getParentId();
            }
        }

        List<SysMenuEntity> visibleMenus = allMenus.stream()
                .filter(menu -> visibleIds.contains(menu.getId()) && !"action".equals(menu.getType()))
                .collect(Collectors.toList());
        return buildMenuTree(visibleMenus);
    }

    public Set<String> getGrantedCodes(Long userId) {
        return listGrantedMenus(userId).stream()
                .map(SysMenuEntity::getCode)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public List<SysRoleEntity> listRolesByIds(Set<Long> roleIds) {
        if (roleIds.isEmpty()) {
            return Collections.emptyList();
        }
        return sysRoleMapper.selectList(new LambdaQueryWrapper<SysRoleEntity>().in(SysRoleEntity::getId, roleIds));
    }

    public List<SystemMenuDto> buildMenuTree(List<SysMenuEntity> menus) {
        Map<Long, SystemMenuDto> dtoMap = new LinkedHashMap<Long, SystemMenuDto>();
        menus.forEach(menu -> dtoMap.put(menu.getId(), toMenuDto(menu, new ArrayList<SystemMenuDto>())));

        List<SystemMenuDto> roots = new ArrayList<SystemMenuDto>();
        for (SysMenuEntity menu : menus) {
            SystemMenuDto dto = dtoMap.get(menu.getId());
            if (menu.getParentId() != null && dtoMap.containsKey(menu.getParentId())) {
                dtoMap.get(menu.getParentId()).getChildren().add(dto);
            } else {
                roots.add(dto);
            }
        }
        return roots;
    }

    public RoleOptionDto toRoleOption(SysRoleEntity entity) {
        return RoleOptionDto.builder()
                .id(entity.getId())
                .code(entity.getCode())
                .name(entity.getName())
                .enabled(entity.getEnabled() != null && entity.getEnabled() == 1)
                .builtIn(entity.getBuiltIn() != null && entity.getBuiltIn() == 1)
                .adminRole(entity.getAdminRole() != null && entity.getAdminRole() == 1)
                .build();
    }

    public SystemMenuDto toMenuDto(SysMenuEntity entity, List<SystemMenuDto> children) {
        return SystemMenuDto.builder()
                .id(entity.getId())
                .parentId(entity.getParentId())
                .code(entity.getCode())
                .name(entity.getName())
                .type(entity.getType())
                .routeKey(entity.getRouteKey())
                .icon(entity.getIcon())
                .sortOrder(entity.getSortOrder())
                .enabled(entity.getEnabled() != null && entity.getEnabled() == 1)
                .children(children)
                .build();
    }

    public List<SysMenuEntity> listAllMenus() {
        return sysMenuMapper.selectList(new LambdaQueryWrapper<SysMenuEntity>()
                .orderByAsc(SysMenuEntity::getSortOrder)
                .orderByAsc(SysMenuEntity::getId));
    }

    private List<SysMenuEntity> listGrantedMenus(Long userId) {
        Set<Long> roleIds = getRoleIdsForUser(userId);
        if (roleIds.isEmpty()) {
            return Collections.emptyList();
        }
        Set<Long> menuIds = new LinkedHashSet<Long>(sysRolePermissionMapper.selectList(
                        new LambdaQueryWrapper<SysRolePermissionEntity>().in(SysRolePermissionEntity::getRoleId, roleIds))
                .stream()
                .map(SysRolePermissionEntity::getMenuId)
                .collect(Collectors.toList()));
        if (menuIds.isEmpty()) {
            return Collections.emptyList();
        }
        return sysMenuMapper.selectList(new LambdaQueryWrapper<SysMenuEntity>()
                .in(SysMenuEntity::getId, menuIds)
                .eq(SysMenuEntity::getEnabled, 1));
    }
}
