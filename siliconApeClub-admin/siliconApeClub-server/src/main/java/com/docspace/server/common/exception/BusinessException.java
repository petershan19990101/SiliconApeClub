/**
 * BusinessException 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.common.exception;

public class BusinessException extends RuntimeException {

    public BusinessException(String message) {
        super(message);
    }
}

