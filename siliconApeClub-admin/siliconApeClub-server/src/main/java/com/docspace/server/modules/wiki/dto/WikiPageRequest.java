package com.docspace.server.modules.wiki.dto;

import java.util.List;
import java.util.Map;
import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class WikiPageRequest {
    @NotBlank
    private String title;
    private String pageType;
    private String summary;
    private String content;
    private Map<String, Object> metadata;
    private List<String> tags;
    private Long departmentId;
    private Long aclPolicyId;
}
