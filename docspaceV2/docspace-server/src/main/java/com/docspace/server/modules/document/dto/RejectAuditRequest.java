/**
 * RejectAuditRequest 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RejectAuditRequest {

    @NotBlank
    private String reason;
}

