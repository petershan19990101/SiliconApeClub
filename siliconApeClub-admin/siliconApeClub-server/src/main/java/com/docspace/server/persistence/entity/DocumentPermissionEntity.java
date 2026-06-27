/**
 * 文档权限实体，对应文档级授权记录表。
 */
package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("ds_document_permission")
public class DocumentPermissionEntity {

    /** 权限记录主键。 */
    @TableId
    private Long id;
    /** 文档 ID。 */
    private Long documentId;
    /** 用户 ID。 */
    private Long userId;
    /** 角色编码。 */
    private String roleCode;
    /** 权限动作 JSON。 */
    private String permissionsJson;
    /** 权限继承来源。 */
    private String inheritedFrom;
    /** 创建时间。 */
    private LocalDateTime createdAt;
    /** 更新时间。 */
    private LocalDateTime updatedAt;
}
