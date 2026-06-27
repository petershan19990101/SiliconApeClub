/**
 * FolderDto 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.folder.dto;

import com.docspace.server.modules.document.dto.AccessControlEntryDto;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FolderDto {

    private Long id;
    private String name;
    private Long departmentId;
    private Long parentId;
    private List<AccessControlEntryDto> accessControl;
    private LocalDateTime createdAt;
}

