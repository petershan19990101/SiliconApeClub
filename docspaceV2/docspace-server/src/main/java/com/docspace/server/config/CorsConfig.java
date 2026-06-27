/**
 * 跨域配置，允许通过配置文件或配置中心调整不同环境的前端来源。
 */
package com.docspace.server.config;

import com.docspace.server.config.properties.DocspaceCorsProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
public class CorsConfig {

    /** 注册统一的跨域规则。 */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(DocspaceCorsProperties properties) {
        return request -> {
            CorsConfiguration configuration = new CorsConfiguration();
            configuration.setAllowCredentials(properties.isAllowCredentials());
            configuration.setMaxAge(properties.getMaxAge());
            configuration.setAllowedMethods(properties.getAllowedMethods());
            configuration.setAllowedHeaders(properties.getAllowedHeaders());
            configuration.setExposedHeaders(properties.getExposedHeaders());

            String origin = request.getHeader(HttpHeaders.ORIGIN);
            if (origin != null && properties.getAllowedOrigins().stream().anyMatch(origin::equalsIgnoreCase)) {
                configuration.addAllowedOrigin(origin);
            }
            return configuration;
        };
    }
}
