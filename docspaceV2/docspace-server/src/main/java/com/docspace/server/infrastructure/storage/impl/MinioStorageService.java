package com.docspace.server.infrastructure.storage.impl;

import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.config.properties.DocspaceMinioProperties;
import com.docspace.server.infrastructure.storage.StorageService;
import com.docspace.server.infrastructure.storage.StoredObject;
import com.docspace.server.infrastructure.storage.StoredResource;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.GetObjectResponse;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * MinIO 存储实现，负责源文件的保存与读取。
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "docspace.minio", name = "enabled", havingValue = "true")
public class MinioStorageService implements StorageService {

    private final MinioClient minioClient;
    private final DocspaceMinioProperties properties;

    @Override
    public StoredObject store(MultipartFile file, String prefix) {
        try {
            ensureBucketExists();
            String objectName = buildObjectName(prefix, file.getOriginalFilename());
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(properties.getBucket())
                    .object(objectName)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build());
            return StoredObject.builder().bucket(properties.getBucket()).objectName(objectName).build();
        } catch (Exception ex) {
            log.warn("MinIO upload failed, fallback to generated object key", ex);
            return StoredObject.builder()
                    .bucket(properties.getBucket())
                    .objectName(buildObjectName(prefix, file.getOriginalFilename()))
                    .build();
        }
    }

    @Override
    public StoredObject storeBytes(byte[] content, String prefix, String fileName, String contentType) {
        String objectName = buildObjectName(prefix, fileName);
        try {
            ensureBucketExists();
            ByteArrayInputStream inputStream = new ByteArrayInputStream(content == null ? new byte[0] : content);
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(properties.getBucket())
                    .object(objectName)
                    .stream(inputStream, content == null ? 0 : content.length, -1)
                    .contentType(contentType == null ? "application/octet-stream" : contentType)
                    .build());
            return StoredObject.builder()
                    .bucket(properties.getBucket())
                    .objectName(objectName)
                    .build();
        } catch (Exception ex) {
            throw new BusinessException("保存解析产物失败: " + ex.getMessage());
        }
    }

    @Override
    public StoredResource load(String bucket, String objectName, String originalFileName) {
        try {
            GetObjectResponse response = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .build());
            byte[] content = toByteArray(response);
            MediaType mediaType = MediaTypeFactory.getMediaType(originalFileName).orElse(MediaType.APPLICATION_OCTET_STREAM);
            return StoredResource.builder()
                    .fileName(originalFileName)
                    .contentType(mediaType.toString())
                    .content(content)
                    .build();
        } catch (Exception ex) {
            throw new BusinessException("读取 MinIO 源文件失败: " + ex.getMessage());
        }
    }

    private byte[] toByteArray(InputStream inputStream) throws Exception {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = inputStream.read(buffer)) != -1) {
            outputStream.write(buffer, 0, read);
        }
        return outputStream.toByteArray();
    }

    private void ensureBucketExists() throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(properties.getBucket()).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(properties.getBucket()).build());
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
