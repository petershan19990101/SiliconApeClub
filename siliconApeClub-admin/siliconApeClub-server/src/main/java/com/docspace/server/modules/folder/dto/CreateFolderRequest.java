/**
 * CreateFolderRequest 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.folder.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateFolderRequest {

    @NotBlank
    private String name;

    private Long departmentId;

    private Long parentId;
}
