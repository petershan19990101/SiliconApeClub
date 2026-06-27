package com.docspace.server.modules.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.admin.dto.MenuUpsertRequest;
import com.docspace.server.modules.admin.dto.SystemMenuDto;
import com.docspace.server.persistence.entity.SysMenuEntity;
import com.docspace.server.persistence.entity.SysRolePermissionEntity;
import com.docspace.server.persistence.mapper.SysMenuMapper;
import com.docspace.server.persistence.mapper.SysRolePermissionMapper;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MenuAdminService {

    private final SysMenuMapper sysMenuMapper;
    private final SysRolePermissionMapper sysRolePermissionMapper;
    private final RbacPermissionService rbacPermissionService;
    private final PermissionAuditService permissionAuditService;

    public List<SystemMenuDto> listMenus() {
        return rbacPermissionService.listAllMenus().stream()
                .map(menu -> rbacPermissionService.toMenuDto(menu, Collections.<SystemMenuDto>emptyList()))
                .collect(java.util.stream.Collectors.toList());
    }

    public List<SystemMenuDto> listMenuTree() {
        return rbacPermissionService.buildMenuTree(rbacPermissionService.listAllMenus());
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemMenuDto create(MenuUpsertRequest request, SecurityUser operator) {
        validateRequest(request, null);
        SysMenuEntity entity = new SysMenuEntity();
        fillEntity(entity, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        sysMenuMapper.insert(entity);
        permissionAuditService.record("MENU", entity.getId(), entity.getName(), "CREATE", operator, new HashMap<String, Object>() {{
            put("code", entity.getCode());
            put("type", entity.getType());
        }});
        return rbacPermissionService.toMenuDto(entity, new java.util.ArrayList<SystemMenuDto>());
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemMenuDto update(Long id, MenuUpsertRequest request, SecurityUser operator) {
        SysMenuEntity entity = getRequiredMenu(id);
        validateRequest(request, id);
        fillEntity(entity, request);
        entity.setUpdatedAt(LocalDateTime.now());
        sysMenuMapper.updateById(entity);
        permissionAuditService.record("MENU", entity.getId(), entity.getName(), "UPDATE", operator, new HashMap<String, Object>() {{
            put("code", entity.getCode());
            put("type", entity.getType());
            put("routeKey", entity.getRouteKey());
        }});
        return rbacPermissionService.toMenuDto(entity, new java.util.ArrayList<SystemMenuDto>());
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id, SecurityUser operator) {
        SysMenuEntity entity = getRequiredMenu(id);
        long childCount = sysMenuMapper.selectCount(new LambdaQueryWrapper<SysMenuEntity>().eq(SysMenuEntity::getParentId, id));
        if (childCount > 0) {
            throw new BusinessException("当前菜单下仍有子节点，不能直接删除");
        }
        long rolePermissionCount = sysRolePermissionMapper.selectCount(new LambdaQueryWrapper<SysRolePermissionEntity>().eq(SysRolePermissionEntity::getMenuId, id));
        if (rolePermissionCount > 0) {
            throw new BusinessException("当前菜单已被角色授权，不能直接删除");
        }
        sysMenuMapper.deleteById(id);
        permissionAuditService.record("MENU", id, entity.getName(), "DELETE", operator, Collections.<String, Object>emptyMap());
    }

    public SysMenuEntity getRequiredMenu(Long id) {
        SysMenuEntity entity = sysMenuMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("菜单不存在: " + id);
        }
        return entity;
    }

    private void fillEntity(SysMenuEntity entity, MenuUpsertRequest request) {
        entity.setParentId(request.getParentId());
        entity.setCode(request.getCode().trim());
        entity.setName(request.getName().trim());
        entity.setType(request.getType().trim().toLowerCase());
        entity.setRouteKey(blankToNull(request.getRouteKey()));
        entity.setIcon(blankToNull(request.getIcon()));
        entity.setSortOrder(request.getSortOrder());
        entity.setEnabled(request.getEnabled() ? 1 : 0);
    }

    private void validateRequest(MenuUpsertRequest request, Long currentId) {
        if (!Arrays.asList("menu", "page", "action").contains(request.getType().trim().toLowerCase())) {
            throw new BusinessException("菜单类型必须是 menu/page/action");
        }
        SysMenuEntity duplicate = sysMenuMapper.selectOne(new LambdaQueryWrapper<SysMenuEntity>()
                .eq(SysMenuEntity::getCode, request.getCode().trim())
                .ne(currentId != null, SysMenuEntity::getId, currentId)
                .last("limit 1"));
        if (duplicate != null) {
            throw new BusinessException("菜单编码已存在: " + request.getCode());
        }
        if ("page".equals(request.getType().trim().toLowerCase()) && blankToNull(request.getRouteKey()) == null) {
            throw new BusinessException("页面类型菜单必须绑定路由键");
        }
        if ("action".equals(request.getType().trim().toLowerCase()) && blankToNull(request.getRouteKey()) != null) {
            throw new BusinessException("按钮权限点不允许绑定路由键");
        }
        if (request.getParentId() != null) {
            SysMenuEntity parent = getRequiredMenu(request.getParentId());
            if ("action".equals(parent.getType())) {
                throw new BusinessException("按钮权限点不能作为父级菜单");
            }
        }
    }

    private String blankToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }
}
