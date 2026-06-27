package com.docspace.server.modules.admin.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MenuUpsertRequest {

    private Long parentId;
    @NotBlank
    private String code;
    @NotBlank
    private String name;
    @NotBlank
    private String type;
    private String routeKey;
    private String icon;
    @NotNull
    private Integer sortOrder;
    @NotNull
    private Boolean enabled;
}
