/**
 * PermissionUpdateRequest 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import java.util.List;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PermissionUpdateRequest {

    @NotNull
    private List<AccessControlEntryDto> accessControl;
}

