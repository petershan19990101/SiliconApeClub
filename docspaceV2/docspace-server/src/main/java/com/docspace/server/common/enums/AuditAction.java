package com.docspace.server.common.enums;

/**
 * 文档审计动作枚举，统一记录文档生命周期关键事件。
 */
public enum AuditAction {
    UPLOAD,
    PARSE,
    DELETE,
    SAVE,
    SUBMIT,
    PUBLISH,
    REJECT,
    LOCK,
    UNLOCK,
    REPARSE,
    RAG_SYNC,
    CREATE_REVISION
}
