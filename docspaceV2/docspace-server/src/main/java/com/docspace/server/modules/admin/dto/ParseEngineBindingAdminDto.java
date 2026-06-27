package com.docspace.server.modules.admin.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ParseEngineBindingAdminDto {

    private Long id;
    private String fileExtension;
    private String engineCode;
    private String engineName;
    private Boolean defaultBinding;
    private Boolean enabled;
    private Integer sortOrder;
}
