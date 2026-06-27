package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("sys_menu")
public class SysMenuEntity {

    @TableId
    private Long id;
    private Long parentId;
    private String code;
    private String name;
    private String type;
    private String routeKey;
    private String icon;
    private Integer sortOrder;
    private Integer enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
