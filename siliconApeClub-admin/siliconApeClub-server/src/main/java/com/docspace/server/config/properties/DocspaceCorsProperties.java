/**
 * CORS 相关配置，支持按环境通过配置中心覆盖允许访问的前端来源。
 */
package com.docspace.server.config.properties;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "docspace.cors")
public class DocspaceCorsProperties {

    private boolean allowCredentials = true;
    private long maxAge = 1800L;
    private List<String> allowedOrigins = new ArrayList<>(Arrays.asList(
            "http://localhost:3000",
            "http://127.0.0.1:3000"));
    private List<String> allowedMethods = new ArrayList<>(Arrays.asList(
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "OPTIONS"));
    private List<String> allowedHeaders = new ArrayList<>(Arrays.asList("*"));
    private List<String> exposedHeaders = new ArrayList<>(Arrays.asList("Authorization"));
}
