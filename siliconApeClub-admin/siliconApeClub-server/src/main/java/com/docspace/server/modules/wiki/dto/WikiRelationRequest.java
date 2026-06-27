package com.docspace.server.modules.wiki.dto;

import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class WikiRelationRequest {
    @NotNull
    private Long targetPageId;
    private String relationType;
}
