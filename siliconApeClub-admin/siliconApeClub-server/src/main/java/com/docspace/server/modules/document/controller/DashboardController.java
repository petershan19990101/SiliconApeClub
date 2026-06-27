/**
 * DashboardController 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.document.dto.ActivityItemDto;
import com.docspace.server.modules.document.dto.StatCardDto;
import com.docspace.server.modules.document.service.DocumentQueryService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DocumentQueryService documentQueryService;

    @GetMapping("/stats")
    public ApiResponse<List<StatCardDto>> stats() {
        return ApiResponse.success(documentQueryService.listStats());
    }

    @GetMapping("/activities")
    public ApiResponse<List<ActivityItemDto>> activities(@RequestParam(defaultValue = "10") int limit) {
        return ApiResponse.success(documentQueryService.listActivities(limit));
    }
}

