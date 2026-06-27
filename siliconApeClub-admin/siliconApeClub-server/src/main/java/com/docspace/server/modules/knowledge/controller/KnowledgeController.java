package com.docspace.server.modules.knowledge.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.knowledge.dto.PermissionCheckRequest;
import com.docspace.server.modules.knowledge.dto.SyncJobRequest;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import java.util.Map;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/knowledge")
@RequiredArgsConstructor
public class KnowledgeController {

    private final KnowledgeService knowledgeService;

    @PostMapping("/sync-jobs")
    public ApiResponse<Map<String, Object>> createSyncJob(@Valid @RequestBody SyncJobRequest request,
                                                          @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(knowledgeService.createSyncJob(request, currentUser));
    }

    @GetMapping("/sync-jobs/{id}")
    public ApiResponse<Map<String, Object>> getSyncJob(@PathVariable Long id) {
        return ApiResponse.success(knowledgeService.getSyncJob(id));
    }

    @GetMapping("/indexed-chunks")
    public ApiResponse<List<Map<String, Object>>> indexedChunks() {
        return ApiResponse.success(knowledgeService.listIndexedChunks(50));
    }

    @PostMapping("/chunks/{id}/permission-check")
    public ApiResponse<Map<String, Object>> checkPermission(@PathVariable Long id,
                                                            @RequestBody PermissionCheckRequest request) {
        return ApiResponse.success(knowledgeService.checkChunkPermission(id, request));
    }

    @GetMapping("/citations")
    public ApiResponse<List<Map<String, Object>>> citations() {
        return ApiResponse.success(knowledgeService.listCitations());
    }

    @PostMapping("/citations")
    public ApiResponse<Void> recordCitation(@RequestBody Map<String, Object> body) {
        knowledgeService.recordCitation(body);
        return ApiResponse.success(null);
    }
}
