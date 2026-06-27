package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("sys_role")
public class SysRoleEntity {

    @TableId
    private Long id;
    private String code;
    private String name;
    private String description;
    private Integer enabled;
    private Integer builtIn;
    private Integer adminRole;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
