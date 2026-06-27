package com.docspace.server.modules.document.service;

import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.infrastructure.preview.PreviewConversionService;
import com.docspace.server.infrastructure.storage.StorageService;
import com.docspace.server.infrastructure.storage.StoredResource;
import com.docspace.server.persistence.entity.DocumentEntity;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DocumentSourceService {

    private final DocumentSupportService documentSupportService;
    private final PermissionSupportService permissionSupportService;
    private final StorageService storageService;
    private final List<PreviewConversionService> previewConversionServices;

    public StoredResource loadSourceFile(Long documentId, SecurityUser currentUser) {
        DocumentEntity document = documentSupportService.getRequiredDocument(documentId);
        permissionSupportService.ensureCanViewDocument(documentId, currentUser);
        if (document.getStorageBucket() == null || document.getStorageObject() == null) {
            throw new BusinessException("当前文档未保存可预览的原始文件");
        }
        return storageService.load(document.getStorageBucket(), document.getStorageObject(), document.getLatestSourceFile());
    }

    public StoredResource loadPreviewFile(Long documentId, SecurityUser currentUser) {
        DocumentEntity document = documentSupportService.getRequiredDocument(documentId);
        permissionSupportService.ensureCanViewDocument(documentId, currentUser);
        StoredResource sourceResource = loadSourceFile(documentId, currentUser);

        for (PreviewConversionService previewConversionService : previewConversionServices) {
          if (previewConversionService.supports(document)) {
              return previewConversionService.convert(document, sourceResource);
          }
        }

        if (isPptxDocument(document)) {
            throw new BusinessException("当前环境暂不支持 PPTX 在线预览，请联系管理员配置 LibreOffice 文档转换服务。");
        }

        return sourceResource;
    }

    private boolean isPptxDocument(DocumentEntity document) {
        return document.getLatestSourceFile() != null && document.getLatestSourceFile().toLowerCase().endsWith(".pptx");
    }
}
