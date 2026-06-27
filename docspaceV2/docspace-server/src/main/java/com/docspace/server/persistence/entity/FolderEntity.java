/**
 * 目录实体，对应文档库目录表。
 */
package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("ds_folder")
public class FolderEntity {

    /** 目录主键 ID。 */
    @TableId
    private Long id;
    /** 目录名称。 */
    private String name;
    /** 归属部门 ID。 */
    private Long departmentId;
    /** 父目录 ID。 */
    private Long parentId;
    /** 创建人 ID。 */
    private Long createdBy;
    private Integer deleted;
    /** 创建时间。 */
    private LocalDateTime createdAt;
    /** 更新时间。 */
    private LocalDateTime updatedAt;
}
