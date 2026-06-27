/**
 * 登录请求 DTO，承载用户名和密码。
 */
package com.docspace.server.modules.auth.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    /** 登录用户名。 */
    @NotBlank
    private String username;

    /** 登录密码。 */
    @NotBlank
    private String password;
}
