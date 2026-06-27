/**
 * SaveCorrectionRequest 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import java.util.List;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SaveCorrectionRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String description;

    @NotNull
    private List<String> tags;

    @NotBlank
    private String latestParsedText;
}

