package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("sys_user_role")
public class SysUserRoleEntity {

    @TableId
    private Long id;
    private Long userId;
    private Long roleId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
