package com.docspace.server.modules.health.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.health.dto.HealthIssueUpdateRequest;
import com.docspace.server.modules.health.dto.MaintenanceWindowRequest;
import com.docspace.server.modules.health.service.KnowledgeHealthService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/knowledge-health")
@RequiredArgsConstructor
public class KnowledgeHealthController {

    private final KnowledgeHealthService knowledgeHealthService;

    @GetMapping("/issues")
    public ApiResponse<List<Map<String, Object>>> issues(@RequestParam(required = false) String status) {
        return ApiResponse.success(knowledgeHealthService.listIssues(status));
    }

    @PutMapping("/issues/{id}")
    public ApiResponse<Map<String, Object>> updateIssue(@PathVariable Long id,
                                                        @RequestBody HealthIssueUpdateRequest request,
                                                        @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(knowledgeHealthService.updateIssue(id, request, currentUser));
    }

    @GetMapping("/reports")
    public ApiResponse<List<Map<String, Object>>> reports() {
        return ApiResponse.success(knowledgeHealthService.listReports());
    }

    @PostMapping("/reports/generate")
    public ApiResponse<Map<String, Object>> generateReport(@AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(knowledgeHealthService.generateReport(currentUser));
    }

    @GetMapping("/maintenance-window")
    public ApiResponse<Map<String, Object>> maintenanceWindow() {
        return ApiResponse.success(knowledgeHealthService.getMaintenanceWindow());
    }

    @PostMapping("/maintenance-window/start")
    public ApiResponse<Map<String, Object>> startWindow(@RequestBody(required = false) MaintenanceWindowRequest request,
                                                        @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(knowledgeHealthService.startWindow(request, currentUser));
    }

    @PostMapping("/maintenance-window/end")
    public ApiResponse<Map<String, Object>> endWindow(@AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(knowledgeHealthService.endWindow(currentUser));
    }
}
