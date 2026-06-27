/**
 * 后端应用启动入口，负责启动 Spring Boot 并启用配置属性与 Mapper 扫描。
 */
package com.docspace.server;

import com.docspace.server.config.properties.DocspaceCorsProperties;
import com.docspace.server.config.properties.DocspaceMinioProperties;
import com.docspace.server.config.properties.DocspaceRocketMqProperties;
import com.docspace.server.config.properties.DocspaceRedisProperties;
import com.docspace.server.config.properties.JwtProperties;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

@SpringBootApplication
@MapperScan("com.docspace.server.persistence.mapper")
@EnableConfigurationProperties({
        DocspaceCorsProperties.class,
        JwtProperties.class,
        DocspaceRedisProperties.class,
        DocspaceRocketMqProperties.class,
        DocspaceMinioProperties.class
})
public class SiliconApeClubServerApplication extends SpringBootServletInitializer {

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder application) {
        return application.sources(SiliconApeClubServerApplication.class);
    }

    public static void main(String[] args) {
        SpringApplication.run(SiliconApeClubServerApplication.class, args);
    }
}

