/**
 * DocspaceMinioProperties 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.config.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "docspace.minio")
public class DocspaceMinioProperties {

    private boolean enabled = true;
    private String endpoint;
    private String accessKey;
    private String secretKey;
    private String bucket = "docspace";
}

