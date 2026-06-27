package com.docspace.server.modules.pipeline.dto;

import java.util.List;
import lombok.Data;

@Data
public class DocumentToWikiRequest {
    private Boolean publish;
    private String title;
    private String summary;
    private List<String> tags;
}
