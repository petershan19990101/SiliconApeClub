package com.docspace.server.infrastructure.messaging.impl;

import com.docspace.server.config.properties.DocspaceRocketMqProperties;
import com.docspace.server.infrastructure.messaging.DocumentLifecycleEvent;
import com.docspace.server.infrastructure.messaging.DomainEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.apache.rocketmq.spring.core.RocketMQTemplate;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "docspace.rocketmq", name = "enabled", havingValue = "true")
public class RocketMqDomainEventPublisher implements DomainEventPublisher {

    private final RocketMQTemplate rocketMQTemplate;
    private final DocspaceRocketMqProperties properties;

    @Override
    public void publish(DocumentLifecycleEvent event) {
        try {
            rocketMQTemplate.convertAndSend(properties.getTopic().getDocumentLifecycle(), event);
        } catch (Exception ex) {
            log.warn("Failed to publish document event {}", event, ex);
        }
    }
}
