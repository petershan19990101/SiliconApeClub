package com.docspace.server.modules.admin.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ParseEngineBindingUpsertRequest {

    @NotBlank
    private String fileExtension;

    @NotBlank
    private String engineCode;

    @NotNull
    private Boolean defaultBinding;

    @NotNull
    private Boolean enabled;

    @NotNull
    private Integer sortOrder;
}
