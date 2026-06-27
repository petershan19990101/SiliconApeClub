package com.docspace.server.modules.document.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.infrastructure.storage.StorageService;
import com.docspace.server.infrastructure.storage.StoredResource;
import com.docspace.server.modules.document.dto.ParseArtifactDto;
import com.docspace.server.persistence.entity.DocumentParseArtifactEntity;
import com.docspace.server.persistence.mapper.DocumentParseArtifactMapper;
import com.docspace.server.security.SecurityUser;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DocumentParseArtifactService {

    private final DocumentSupportService documentSupportService;
    private final PermissionSupportService permissionSupportService;
    private final DocumentParseArtifactMapper documentParseArtifactMapper;
    private final StorageService storageService;

    public List<ParseArtifactDto> listArtifacts(Long documentId, Integer version, SecurityUser currentUser) {
        documentSupportService.getRequiredDocument(documentId);
        permissionSupportService.ensureCanViewDocument(documentId, currentUser);
        List<DocumentParseArtifactEntity> entities = documentParseArtifactMapper.selectList(
                new LambdaQueryWrapper<DocumentParseArtifactEntity>()
                        .eq(DocumentParseArtifactEntity::getDocumentId, documentId)
                        .eq(DocumentParseArtifactEntity::getVersion, version)
                        .orderByAsc(DocumentParseArtifactEntity::getPageNo)
                        .orderByAsc(DocumentParseArtifactEntity::getSequenceNo)
                        .orderByAsc(DocumentParseArtifactEntity::getId));
        List<ParseArtifactDto> result = new ArrayList<ParseArtifactDto>();
        for (DocumentParseArtifactEntity entity : entities) {
            result.add(ParseArtifactDto.builder()
                    .id(entity.getId())
                    .artifactType(entity.getArtifactType())
                    .artifactName(entity.getArtifactName())
                    .mimeType(entity.getMimeType())
                    .pageNo(entity.getPageNo())
                    .sequenceNo(entity.getSequenceNo())
                    .sizeBytes(entity.getSizeBytes())
                    .createdAt(entity.getCreatedAt())
                    .contentUrl("/api/documents/" + documentId + "/parse-artifacts/" + entity.getId() + "/content")
                    .build());
        }
        return result;
    }

    public StoredResource loadArtifactContent(Long documentId, Long artifactId, SecurityUser currentUser) {
        documentSupportService.getRequiredDocument(documentId);
        permissionSupportService.ensureCanViewDocument(documentId, currentUser);
        DocumentParseArtifactEntity artifact = documentParseArtifactMapper.selectById(artifactId);
        if (artifact == null || !documentId.equals(artifact.getDocumentId())) {
            throw new BusinessException("解析产物不存在");
        }
        StoredResource stored = storageService.load(artifact.getStorageBucket(), artifact.getStorageObject(), artifact.getArtifactName());
        return StoredResource.builder()
                .fileName(artifact.getArtifactName())
                .contentType(artifact.getMimeType() == null ? stored.getContentType() : artifact.getMimeType())
                .content(stored.getContent())
                .build();
    }
}
