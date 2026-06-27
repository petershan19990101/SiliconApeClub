package com.docspace.server.modules.admin.dto;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SystemMenuDto {

    private Long id;
    private Long parentId;
    private String code;
    private String name;
    private String type;
    private String routeKey;
    private String icon;
    private Integer sortOrder;
    private Boolean enabled;
    private List<SystemMenuDto> children;
}
