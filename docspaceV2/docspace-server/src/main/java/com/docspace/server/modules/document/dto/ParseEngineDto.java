package com.docspace.server.modules.document.dto;

import java.util.List;
import lombok.Builder;
import lombok.Data;

/**
 * 解析引擎展示对象，用于前端根据文件类型渲染可选引擎列表。
 */
@Data
@Builder
public class ParseEngineDto {

    /** 引擎编码，作为前后端交互的稳定值。 */
    private String code;
    /** 引擎展示名称。 */
    private String name;
    /** 引擎说明。 */
    private String description;
    /** 支持的文件扩展名。 */
    private List<String> supportedExtensions;
    /** 是否为当前文件类型的默认引擎。 */
    private boolean defaultEngine;
}
