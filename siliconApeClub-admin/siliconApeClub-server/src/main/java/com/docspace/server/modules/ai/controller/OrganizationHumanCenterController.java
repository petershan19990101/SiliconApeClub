package com.docspace.server.modules.ai.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.ai.service.OrganizationHumanCenterService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/org-human-center")
@RequiredArgsConstructor
public class OrganizationHumanCenterController {

    private final OrganizationHumanCenterService organizationHumanCenterService;

    @GetMapping
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(organizationHumanCenterService.overview());
    }

    @PutMapping("/customers/{id}/visibility")
    public ApiResponse<Map<String, Object>> replaceCustomerVisibility(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        return ApiResponse.success(organizationHumanCenterService.replaceCustomerVisibility(id, request));
    }
}
