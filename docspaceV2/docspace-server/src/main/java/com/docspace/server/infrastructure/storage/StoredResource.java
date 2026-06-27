package com.docspace.server.infrastructure.storage;

import lombok.Builder;
import lombok.Data;

/**
 * 已保存源文件的读取结果，用于预览或下载原始文件内容。
 */
@Data
@Builder
public class StoredResource {

    /** 原始文件名。 */
    private String fileName;
    /** 响应内容类型。 */
    private String contentType;
    /** 文件字节内容。 */
    private byte[] content;
}
