/**
 * StartParseRequest 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import lombok.Data;

@Data
public class StartParseRequest {

    private String sourceFileName;
    private String engine;
}

