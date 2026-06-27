package com.docspace.server.modules.health.dto;

import lombok.Data;

@Data
public class HealthIssueUpdateRequest {
    private String status;
    private String suggestedAction;
}
