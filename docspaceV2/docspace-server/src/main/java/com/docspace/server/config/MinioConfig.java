/**
 * MinioConfig 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.config;

import com.docspace.server.config.properties.DocspaceMinioProperties;
import io.minio.MinioClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

    @Bean
    public MinioClient minioClient(DocspaceMinioProperties properties) {
        return MinioClient.builder()
                .endpoint(properties.getEndpoint())
                .credentials(properties.getAccessKey(), properties.getSecretKey())
                .build();
    }
}

