/**
 * RocketMQ 相关配置。
 */
package com.docspace.server.config.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "docspace.rocketmq")
public class DocspaceRocketMqProperties {

    private boolean enabled = true;
    private Topic topic = new Topic();

    @Data
    public static class Topic {
        private String documentLifecycle = "docspace.document.lifecycle";
    }
}
