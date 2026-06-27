package com.docspace.server.modules.pipeline.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.pipeline.dto.DocumentToWikiRequest;
import com.docspace.server.modules.pipeline.service.KnowledgePipelineService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/knowledge-pipeline")
@RequiredArgsConstructor
public class KnowledgePipelineController {

    private final KnowledgePipelineService knowledgePipelineService;

    @GetMapping("/jobs")
    public ApiResponse<List<Map<String, Object>>> listJobs(@RequestParam(required = false) String status,
                                                           @RequestParam(defaultValue = "100") int limit) {
        return ApiResponse.success(knowledgePipelineService.listJobs(status, limit));
    }

    @GetMapping("/jobs/{id}")
    public ApiResponse<Map<String, Object>> getJob(@PathVariable Long id) {
        return ApiResponse.success(knowledgePipelineService.getJob(id));
    }

    @PostMapping("/documents/{documentId}/to-wiki")
    public ApiResponse<Map<String, Object>> documentToWiki(@PathVariable Long documentId,
                                                           @RequestBody(required = false) DocumentToWikiRequest request,
                                                           @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(knowledgePipelineService.documentToWiki(documentId, request, currentUser));
    }
}
