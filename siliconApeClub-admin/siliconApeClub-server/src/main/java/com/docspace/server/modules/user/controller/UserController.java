/**
 * UserController 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.user.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.user.service.UserQueryService;
import com.docspace.server.modules.user.service.UserSummaryDto;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserQueryService userQueryService;

    @GetMapping
    public ApiResponse<List<UserSummaryDto>> listUsers() {
        return ApiResponse.success(userQueryService.listUsers());
    }
}

