package com.docspace.server.modules.position.dto;

import java.util.Map;
import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PositionPackageRequest {
    @NotBlank
    private String code;
    @NotBlank
    private String name;
    private String description;
    private String positionCode;
    private Map<String, Object> defaultScope;
    private Map<String, Object> rules;
}
