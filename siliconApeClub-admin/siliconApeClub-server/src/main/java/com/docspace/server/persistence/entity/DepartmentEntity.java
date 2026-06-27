/**
 * 部门实体，对应部门表。
 */
package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("ds_department")
public class DepartmentEntity {

    /** 部门主键 ID。 */
    @TableId
    private Long id;
    /** 上级部门 ID，用于构建组织树。 */
    private Long parentId;
    /** 部门名称。 */
    private String name;
    /** 创建时间。 */
    private LocalDateTime createdAt;
    /** 更新时间。 */
    private LocalDateTime updatedAt;
}
