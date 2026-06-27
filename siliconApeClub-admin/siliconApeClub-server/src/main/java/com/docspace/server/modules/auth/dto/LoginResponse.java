/**
 * LoginResponse 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.auth.dto;

import com.docspace.server.modules.user.service.UserSummaryDto;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LoginResponse {

    private String accessToken;
    private long expiresIn;
    private UserSummaryDto user;
}

