package com.docspace.server.modules.knowledge.dto;

import lombok.Data;

@Data
public class PermissionCheckRequest {
    private String actorType;
    private String actorId;
    private String departmentId;
    private String positionCode;
    private String action;
}
