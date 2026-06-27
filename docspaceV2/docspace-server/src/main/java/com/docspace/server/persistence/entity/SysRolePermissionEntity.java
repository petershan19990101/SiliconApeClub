package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("sys_role_permission")
public class SysRolePermissionEntity {

    @TableId
    private Long id;
    private Long roleId;
    private Long menuId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
