package com.docspace.server.modules.knowledge.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.knowledge.dto.PermissionCheckRequest;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/internal/knowledge")
@RequiredArgsConstructor
public class InternalKnowledgeController {

    private final KnowledgeService knowledgeService;

    @Value("${docspace.retrieval.service-token:docspace-retrieval-dev-token}")
    private String serviceToken;

    @PostMapping("/chunks/{id}/permission-check")
    public ApiResponse<Map<String, Object>> checkPermission(@PathVariable Long id,
                                                            @RequestBody PermissionCheckRequest request,
                                                            @RequestHeader("X-Service-Token") String token) {
        ensureToken(token);
        return ApiResponse.success(knowledgeService.checkChunkPermission(id, request));
    }

    @PostMapping("/citations")
    public ApiResponse<Void> recordCitation(@RequestBody Map<String, Object> body,
                                            @RequestHeader("X-Service-Token") String token) {
        ensureToken(token);
        knowledgeService.recordCitation(body);
        return ApiResponse.success(null);
    }

    private void ensureToken(String token) {
        if (token == null || !token.equals(serviceToken)) {
            throw new BusinessException("内部服务 Token 无效");
        }
    }
}
