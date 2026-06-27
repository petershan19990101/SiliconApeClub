/**
 * StorageService 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.infrastructure.storage;

import org.springframework.web.multipart.MultipartFile;

public interface StorageService {

    StoredObject store(MultipartFile file, String prefix);

    StoredObject storeBytes(byte[] content, String prefix, String fileName, String contentType);

    StoredResource load(String bucket, String objectName, String originalFileName);
}

