/**
 * StoredObject 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.infrastructure.storage;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StoredObject {

    private String bucket;
    private String objectName;
}

