package com.docspace.server.modules.admin.service;

import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.persistence.entity.SysPermissionAuditEntity;
import com.docspace.server.persistence.mapper.SysPermissionAuditMapper;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PermissionAuditService {

    private final SysPermissionAuditMapper sysPermissionAuditMapper;
    private final JsonUtils jsonUtils;

    public void record(String targetType, Long targetId, String targetName, String action, SecurityUser operator, Map<String, Object> detail) {
        SysPermissionAuditEntity entity = new SysPermissionAuditEntity();
        entity.setTargetType(targetType);
        entity.setTargetId(targetId);
        entity.setTargetName(targetName);
        entity.setAction(action);
        entity.setOperatorId(operator.getId());
        entity.setOperatorName(operator.getDisplayName());
        entity.setDetailJson(detail == null ? null : jsonUtils.toJson(detail));
        entity.setCreatedAt(LocalDateTime.now());
        sysPermissionAuditMapper.insert(entity);
    }
}
