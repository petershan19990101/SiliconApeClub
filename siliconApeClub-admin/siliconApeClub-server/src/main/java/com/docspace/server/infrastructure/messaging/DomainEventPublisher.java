/**
 * DomainEventPublisher 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.infrastructure.messaging;

public interface DomainEventPublisher {

    void publish(DocumentLifecycleEvent event);
}

