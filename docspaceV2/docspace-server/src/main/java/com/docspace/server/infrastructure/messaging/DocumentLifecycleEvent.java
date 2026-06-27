/**
 * DocumentLifecycleEvent 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.infrastructure.messaging;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DocumentLifecycleEvent {

    private String action;
    private Long documentId;
    private String documentStatus;
    private Long operatorId;
    private LocalDateTime occurredAt;
}

