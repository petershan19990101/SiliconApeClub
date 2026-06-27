/**
 * NoOpDomainEventPublisher 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.infrastructure.messaging.impl;

import com.docspace.server.infrastructure.messaging.DocumentLifecycleEvent;
import com.docspace.server.infrastructure.messaging.DomainEventPublisher;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "docspace.rocketmq", name = "enabled", havingValue = "false", matchIfMissing = true)
public class NoOpDomainEventPublisher implements DomainEventPublisher {

    @Override
    public void publish(DocumentLifecycleEvent event) {
    }
}
