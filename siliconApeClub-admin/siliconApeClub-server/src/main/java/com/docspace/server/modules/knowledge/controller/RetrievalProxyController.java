package com.docspace.server.modules.knowledge.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.knowledge.service.RetrievalProxyService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/retrieval")
@RequiredArgsConstructor
public class RetrievalProxyController {

    private final RetrievalProxyService retrievalProxyService;

    @PostMapping("/debug")
    public ApiResponse<Map<String, Object>> debug(@RequestBody Map<String, Object> request) {
        return ApiResponse.success(retrievalProxyService.debug(request));
    }
}
