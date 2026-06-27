/**
 * AccessControlEntryDto 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import com.docspace.server.common.enums.UserRole;
import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AccessControlEntryDto {

    private Long userId;
    private String userName;
    private UserRole role;
    private List<String> permissions;
    private String inheritedFrom;
}

