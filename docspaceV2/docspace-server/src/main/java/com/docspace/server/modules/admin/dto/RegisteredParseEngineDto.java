package com.docspace.server.modules.admin.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RegisteredParseEngineDto {

    private String code;
    private String name;
    private String description;
}
