/**
 * 用户实体，对应登录账号和角色信息表。
 */
package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("ds_user")
public class UserEntity {

    /** 用户主键 ID。 */
    @TableId
    private Long id;
    /** 登录用户名。 */
    private String username;
    /** 显示名称。 */
    private String displayName;
    /** 邮箱地址。 */
    private String email;
    /** 密码哈希。 */
    private String passwordHash;
    /** 角色编码。 */
    private String roleCode;
    /** 所属部门 ID。 */
    private Long departmentId;
    /** 启用状态。 */
    private Integer enabled;
    /** 创建时间。 */
    private LocalDateTime createdAt;
    /** 更新时间。 */
    private LocalDateTime updatedAt;
}
