/**
 * 修改密码请求 DTO，承载旧密码、新密码和确认密码。
 */
package com.docspace.server.modules.auth.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import lombok.Data;

@Data
public class ChangePasswordRequest {

    /** 当前密码，用于确认操作者身份。 */
    @NotBlank
    private String currentPassword;

    /** 新密码，要求至少 8 位。 */
    @NotBlank
    @Size(min = 8, max = 64)
    private String newPassword;

    /** 确认密码，需与新密码保持一致。 */
    @NotBlank
    private String confirmPassword;
}
