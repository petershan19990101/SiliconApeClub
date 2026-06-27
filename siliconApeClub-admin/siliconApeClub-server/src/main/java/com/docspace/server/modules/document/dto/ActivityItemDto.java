/**
 * ActivityItemDto 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ActivityItemDto {

    private Long id;
    private String user;
    private String action;
    private String target;
    private LocalDateTime createdAt;
    private String type;
    private List<String> tags;
}

