/**
 * DocumentStatus 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.common.enums;

public enum DocumentStatus {
    UPLOADED,
    PARSING,
    RAG_READY,
    PENDING_AUDIT,
    REJECTED,
    PUBLISHED,
    LOCKED
}

