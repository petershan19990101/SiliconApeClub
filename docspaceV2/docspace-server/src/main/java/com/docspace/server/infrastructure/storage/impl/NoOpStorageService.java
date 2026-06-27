package com.docspace.server.infrastructure.storage.impl;

import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.infrastructure.storage.StorageService;
import com.docspace.server.infrastructure.storage.StoredObject;
import com.docspace.server.infrastructure.storage.StoredResource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * 本地存储实现，供未启用 MinIO 的环境保存并读取源文件。
 */
@Component
@ConditionalOnProperty(prefix = "docspace.minio", name = "enabled", havingValue = "false", matchIfMissing = true)
public class NoOpStorageService implements StorageService {

    private static final String LOCAL_BUCKET = "mock-bucket";
    private static final Path STORAGE_ROOT = Paths.get("data", "source-storage");

    @Override
    public StoredObject store(MultipartFile file, String prefix) {
        String objectName = buildObjectName(prefix, file.getOriginalFilename());
        Path target = STORAGE_ROOT.resolve(objectName);
        try {
            Files.createDirectories(target.getParent());
            file.transferTo(target);
        } catch (IOException ex) {
            throw new BusinessException("保存源文件失败: " + ex.getMessage());
        }
        return StoredObject.builder()
                .bucket(LOCAL_BUCKET)
                .objectName(objectName)
                .build();
    }

    @Override
    public StoredObject storeBytes(byte[] content, String prefix, String fileName, String contentType) {
        String objectName = buildObjectName(prefix, fileName);
        Path target = STORAGE_ROOT.resolve(objectName);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content == null ? new byte[0] : content);
            return StoredObject.builder()
                    .bucket(LOCAL_BUCKET)
                    .objectName(objectName)
                    .build();
        } catch (IOException ex) {
            throw new BusinessException("保存解析产物失败: " + ex.getMessage());
        }
    }

    @Override
    public StoredResource load(String bucket, String objectName, String originalFileName) {
        Path target = STORAGE_ROOT.resolve(objectName);
        if (!Files.exists(target)) {
            throw new BusinessException("源文件不存在或尚未保存到本地存储");
        }
        try {
            MediaType mediaType = MediaTypeFactory.getMediaType(originalFileName).orElse(MediaType.APPLICATION_OCTET_STREAM);
            return StoredResource.builder()
                    .fileName(originalFileName)
                    .contentType(mediaType.toString())
                    .content(Files.readAllBytes(target))
                    .build();
        } catch (IOException ex) {
            throw new BusinessException("读取源文件失败: " + ex.getMessage());
        }
    }

    private String buildObjectName(String prefix, String fileName) {
        String normalizedName = sanitizeFileName(fileName);
        return prefix + "/" + UUID.randomUUID().toString().replace("-", "") + "-" + normalizedName;
    }

    private String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.trim().isEmpty()) {
            return "unnamed";
        }
        return fileName.replace("\\", "_").replace("/", "_");
    }
}
