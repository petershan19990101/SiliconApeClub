package com.docspace.server.modules.knowledge.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.modules.knowledge.service.RagManagementService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rag")
@RequiredArgsConstructor
public class RagManagementController {

    private final KnowledgeService knowledgeService;
    private final RagManagementService ragManagementService;

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(ragManagementService.overview());
    }

    @GetMapping("/indexed-chunks")
    public ApiResponse<List<Map<String, Object>>> indexedChunks(@RequestParam(defaultValue = "50") Integer limit) {
        return ApiResponse.success(knowledgeService.listIndexedChunks(limit == null ? 50 : limit));
    }

    @PutMapping("/chunks/{id}/governance")
    public ApiResponse<Map<String, Object>> updateChunkGovernance(@PathVariable Long id,
                                                                  @RequestBody Map<String, Object> request) {
        return ApiResponse.success(ragManagementService.updateChunkGovernance(id, request));
    }

    @GetMapping("/acl-policies")
    public ApiResponse<List<Map<String, Object>>> policies() {
        return ApiResponse.success(ragManagementService.listPolicies());
    }

    @PostMapping("/acl-policies")
    public ApiResponse<Map<String, Object>> createPolicy(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(ragManagementService.createPolicy(request));
    }

    @PutMapping("/acl-policies/{id}")
    public ApiResponse<Map<String, Object>> updatePolicy(@PathVariable Long id,
                                                         @RequestBody Map<String, Object> request) {
        return ApiResponse.success(ragManagementService.updatePolicy(id, request));
    }

    @GetMapping("/acl-bindings")
    public ApiResponse<List<Map<String, Object>>> bindings(@RequestParam(required = false) Long policyId) {
        return ApiResponse.success(ragManagementService.listBindings(policyId));
    }

    @PostMapping("/acl-bindings")
    public ApiResponse<Map<String, Object>> createBinding(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(ragManagementService.createBinding(request));
    }

    @DeleteMapping("/acl-bindings/{id}")
    public ApiResponse<Void> deleteBinding(@PathVariable Long id) {
        ragManagementService.deleteBinding(id);
        return ApiResponse.success(null);
    }
}
