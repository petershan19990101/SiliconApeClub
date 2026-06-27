package com.docspace.server.modules.health.dto;

import lombok.Data;

@Data
public class MaintenanceWindowRequest {
    private String reason;
}
