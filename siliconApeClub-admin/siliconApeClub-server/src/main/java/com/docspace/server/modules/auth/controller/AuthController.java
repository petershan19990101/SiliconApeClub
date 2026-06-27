/**
 * 认证控制器，提供登录和当前用户信息接口。
 */
package com.docspace.server.modules.auth.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.auth.dto.ChangePasswordRequest;
import com.docspace.server.modules.auth.dto.LoginRequest;
import com.docspace.server.modules.auth.dto.LoginResponse;
import com.docspace.server.modules.auth.service.AuthService;
import com.docspace.server.modules.user.service.UserQueryService;
import com.docspace.server.modules.user.service.UserSummaryDto;
import com.docspace.server.security.SecurityUser;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserQueryService userQueryService;

    /** 用户登录并返回 JWT。 */
    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(authService.login(request));
    }

    /** 查询当前登录用户的基础资料。 */
    @GetMapping("/me")
    public ApiResponse<UserSummaryDto> me(@AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(userQueryService.getById(currentUser.getId()));
    }

    /** 当前登录用户修改自己的密码。 */
    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(@AuthenticationPrincipal SecurityUser currentUser,
                                            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(currentUser, request);
        return ApiResponse.success("密码修改成功", null);
    }

    /** JWT 模式下退出登录主要由前端清理本地令牌，这里保留统一接口。 */
    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        return ApiResponse.success("退出登录成功", null);
    }
}
