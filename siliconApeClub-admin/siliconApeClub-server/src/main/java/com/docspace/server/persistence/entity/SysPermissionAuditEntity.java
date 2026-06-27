package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("sys_permission_audit")
public class SysPermissionAuditEntity {

    @TableId
    private Long id;
    private String targetType;
    private Long targetId;
    private String targetName;
    private String action;
    private Long operatorId;
    private String operatorName;
    private String detailJson;
    private LocalDateTime createdAt;
}
