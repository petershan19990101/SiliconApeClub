package com.docspace.server.modules.audit.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.audit.service.AuditTraceService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit-traces")
@RequiredArgsConstructor
public class AuditTraceController {

    private final AuditTraceService auditTraceService;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) String targetType,
                                                       @RequestParam(required = false) String targetId,
                                                       @RequestParam(defaultValue = "100") int limit) {
        return ApiResponse.success(auditTraceService.list(targetType, targetId, limit));
    }
}
