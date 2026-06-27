package com.docspace.server.modules.notification.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.notification.service.NotificationService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) String status,
                                                       @RequestParam(defaultValue = "50") int limit,
                                                       @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(notificationService.list(currentUser, status, limit));
    }

    @PostMapping("/{id}/read")
    public ApiResponse<Map<String, Object>> markRead(@PathVariable Long id,
                                                     @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(notificationService.markRead(id, currentUser));
    }
}
