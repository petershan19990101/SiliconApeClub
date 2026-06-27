/**
 * JwtProperties 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.config.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "docspace.jwt")
public class JwtProperties {

    private String secret;
    private long expireSeconds = 7200L;
}

