package com.docspace.server.modules.position.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.position.dto.PositionPackageItemsRequest;
import com.docspace.server.modules.position.dto.PositionPackageRequest;
import com.docspace.server.modules.position.service.PositionPackageService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import java.util.Map;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/position-packages")
@RequiredArgsConstructor
public class PositionPackageController {

    private final PositionPackageService positionPackageService;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list() {
        return ApiResponse.success(positionPackageService.listPackages());
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@Valid @RequestBody PositionPackageRequest request,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(positionPackageService.create(request, currentUser));
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> get(@PathVariable Long id) {
        return ApiResponse.success(positionPackageService.getPackage(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<Map<String, Object>> update(@PathVariable Long id,
                                                   @Valid @RequestBody PositionPackageRequest request) {
        return ApiResponse.success(positionPackageService.update(id, request));
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<Map<String, Object>> publish(@PathVariable Long id) {
        return ApiResponse.success(positionPackageService.publish(id));
    }

    @PostMapping("/{id}/submit-review")
    public ApiResponse<Map<String, Object>> submitReview(@PathVariable Long id) {
        return ApiResponse.success(positionPackageService.submitReview(id));
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<Map<String, Object>> reject(@PathVariable Long id) {
        return ApiResponse.success(positionPackageService.reject(id));
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<Map<String, Object>> archive(@PathVariable Long id) {
        return ApiResponse.success(positionPackageService.archive(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        positionPackageService.delete(id);
        return ApiResponse.success(null);
    }

    @PutMapping("/{id}/items")
    public ApiResponse<Map<String, Object>> replaceItems(@PathVariable Long id,
                                                         @RequestBody PositionPackageItemsRequest request) {
        return ApiResponse.success(positionPackageService.replaceItems(id, request));
    }
}
