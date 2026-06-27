package com.docspace.server.modules.document.service;

import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.infrastructure.storage.StorageService;
import com.docspace.server.infrastructure.storage.StoredObject;
import com.docspace.server.infrastructure.storage.StoredResource;
import com.docspace.server.modules.document.parse.DocumentParseEngine;
import com.docspace.server.modules.document.parse.DocumentParseEngineRegistry;
import com.docspace.server.modules.document.parse.ParseEngineOutput;
import com.docspace.server.modules.document.parse.ParseImageArtifact;
import com.docspace.server.modules.document.parse.ParsePageText;
import com.docspace.server.persistence.entity.DocumentEntity;
import com.docspace.server.persistence.entity.DocumentParseArtifactEntity;
import com.docspace.server.persistence.mapper.DocumentParseArtifactMapper;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DocumentParseExecutionService {

    private static final String ARTIFACT_TYPE_TEXT = "text";
    private static final String ARTIFACT_TYPE_IMAGE = "image";
    private static final String ARTIFACT_TYPE_MARKDOWN = "markdown";

    private final StorageService storageService;
    private final DocumentParseEngineRegistry documentParseEngineRegistry;
    private final DocumentParseArtifactMapper documentParseArtifactMapper;

    @Transactional(rollbackFor = Exception.class)
    public ParseExecutionResult execute(Long documentId,
                                        String documentName,
                                        String sourceFileName,
                                        String sourceBucket,
                                        String sourceObject,
                                        Integer version,
                                        ParseEngineService.EngineSelection engineSelection) {
        StoredResource sourceResource = storageService.load(sourceBucket, sourceObject, sourceFileName);
        DocumentParseEngine engine = documentParseEngineRegistry.getRequired(engineSelection.getEngineCode());
        ParseEngineOutput output = engine.parse(sourceResource.getContent());

        List<ParsePageText> pageTexts = output.getPageTexts() == null
                ? Collections.<ParsePageText>emptyList() : new ArrayList<ParsePageText>(output.getPageTexts());
        List<ParseImageArtifact> images = output.getImages() == null
                ? Collections.<ParseImageArtifact>emptyList() : new ArrayList<ParseImageArtifact>(output.getImages());
        pageTexts.sort(Comparator.comparingInt(ParsePageText::getPageNo));
        images.sort(Comparator.comparingInt(ParseImageArtifact::getPageNo).thenComparingInt(ParseImageArtifact::getSequenceNo));

        String storagePrefix = "parse-artifacts/" + documentId + "/v" + version;
        persistTextArtifacts(documentId, version, pageTexts, storagePrefix);
        Map<String, DocumentParseArtifactEntity> imageArtifactMap = persistImageArtifacts(documentId, version, images, storagePrefix);

        String markdown = output.getMarkdownContent();
        if (markdown == null || markdown.trim().isEmpty()) {
            markdown = buildMarkdown(documentId, documentName, pageTexts, imageArtifactMap);
        } else {
            markdown = replaceImagePlaceholders(markdown, documentId, imageArtifactMap);
        }
        persistMarkdownArtifact(documentId, version, markdown, storagePrefix);
        return new ParseExecutionResult(engineSelection.getEngineCode(), engineSelection.getEngineName(), markdown);
    }

    private void persistTextArtifacts(Long documentId,
                                      Integer version,
                                      List<ParsePageText> pageTexts,
                                      String storagePrefix) {
        for (ParsePageText pageText : pageTexts) {
            String fileName = String.format("page-%04d.txt", pageText.getPageNo());
            byte[] bytes = (pageText.getText() == null ? "" : pageText.getText()).getBytes(StandardCharsets.UTF_8);
            StoredObject stored = storageService.storeBytes(bytes, storagePrefix, fileName, "text/plain;charset=UTF-8");
            DocumentParseArtifactEntity artifact = new DocumentParseArtifactEntity();
            artifact.setDocumentId(documentId);
            artifact.setVersion(version);
            artifact.setArtifactType(ARTIFACT_TYPE_TEXT);
            artifact.setArtifactName(fileName);
            artifact.setMimeType("text/plain");
            artifact.setPageNo(pageText.getPageNo());
            artifact.setSequenceNo(0);
            artifact.setStorageBucket(stored.getBucket());
            artifact.setStorageObject(stored.getObjectName());
            artifact.setSizeBytes((long) bytes.length);
            artifact.setCreatedAt(LocalDateTime.now());
            documentParseArtifactMapper.insert(artifact);
        }
    }

    private Map<String, DocumentParseArtifactEntity> persistImageArtifacts(Long documentId,
                                                                           Integer version,
                                                                           List<ParseImageArtifact> images,
                                                                           String storagePrefix) {
        Map<String, DocumentParseArtifactEntity> imageMap = new HashMap<String, DocumentParseArtifactEntity>();
        for (ParseImageArtifact image : images) {
            if (image.getContent() == null || image.getContent().length == 0) {
                continue;
            }
            String extension = image.getExtension() == null || image.getExtension().trim().isEmpty()
                    ? "png" : image.getExtension().toLowerCase();
            String fileName = String.format("page-%04d-image-%03d.%s", image.getPageNo(), image.getSequenceNo(), extension);
            String mimeType = image.getMimeType() == null || image.getMimeType().trim().isEmpty()
                    ? "application/octet-stream" : image.getMimeType();
            StoredObject stored = storageService.storeBytes(image.getContent(), storagePrefix, fileName, mimeType);

            DocumentParseArtifactEntity artifact = new DocumentParseArtifactEntity();
            artifact.setDocumentId(documentId);
            artifact.setVersion(version);
            artifact.setArtifactType(ARTIFACT_TYPE_IMAGE);
            artifact.setArtifactName(fileName);
            artifact.setMimeType(mimeType);
            artifact.setPageNo(image.getPageNo());
            artifact.setSequenceNo(image.getSequenceNo());
            artifact.setStorageBucket(stored.getBucket());
            artifact.setStorageObject(stored.getObjectName());
            artifact.setSizeBytes((long) image.getContent().length);
            artifact.setCreatedAt(LocalDateTime.now());
            documentParseArtifactMapper.insert(artifact);
            imageMap.put(imageKey(image.getPageNo(), image.getSequenceNo()), artifact);
        }
        return imageMap;
    }

    private void persistMarkdownArtifact(Long documentId, Integer version, String markdown, String storagePrefix) {
        byte[] bytes = markdown.getBytes(StandardCharsets.UTF_8);
        String fileName = String.format("parsed-result-v%d.md", version);
        StoredObject stored = storageService.storeBytes(bytes, storagePrefix, fileName, "text/markdown;charset=UTF-8");
        DocumentParseArtifactEntity artifact = new DocumentParseArtifactEntity();
        artifact.setDocumentId(documentId);
        artifact.setVersion(version);
        artifact.setArtifactType(ARTIFACT_TYPE_MARKDOWN);
        artifact.setArtifactName(fileName);
        artifact.setMimeType("text/markdown");
        artifact.setPageNo(null);
        artifact.setSequenceNo(null);
        artifact.setStorageBucket(stored.getBucket());
        artifact.setStorageObject(stored.getObjectName());
        artifact.setSizeBytes((long) bytes.length);
        artifact.setCreatedAt(LocalDateTime.now());
        documentParseArtifactMapper.insert(artifact);
    }

    private String buildMarkdown(Long documentId,
                                 String documentName,
                                 List<ParsePageText> pageTexts,
                                 Map<String, DocumentParseArtifactEntity> imageArtifactMap) {
        StringBuilder builder = new StringBuilder();
        builder.append("# ").append(documentName == null ? "未命名文档" : documentName).append("\n\n");
        if (pageTexts.isEmpty() && imageArtifactMap.isEmpty()) {
            builder.append("（未提取到可用文本和图片内容）\n");
            return builder.toString();
        }
        for (ParsePageText pageText : pageTexts) {
            int pageNo = pageText.getPageNo();
            builder.append("## 第 ").append(pageNo).append(" 页\n\n");
            String text = pageText.getText() == null ? "" : pageText.getText().trim();
            if (text.isEmpty()) {
                builder.append("（本页未提取到文本）\n\n");
            } else {
                builder.append(text).append("\n\n");
            }
            List<DocumentParseArtifactEntity> pageImages = new ArrayList<DocumentParseArtifactEntity>();
            for (Map.Entry<String, DocumentParseArtifactEntity> entry : imageArtifactMap.entrySet()) {
                if (entry.getValue().getPageNo() != null && entry.getValue().getPageNo() == pageNo) {
                    pageImages.add(entry.getValue());
                }
            }
            pageImages.sort(Comparator.comparingInt(item -> item.getSequenceNo() == null ? 0 : item.getSequenceNo()));
            for (DocumentParseArtifactEntity pageImage : pageImages) {
                int sequenceNo = pageImage.getSequenceNo() == null ? 0 : pageImage.getSequenceNo();
                builder.append("![Page ").append(pageNo).append(" Image ").append(sequenceNo).append("](")
                        .append("/api/documents/")
                        .append(documentId)
                        .append("/parse-artifacts/")
                        .append(pageImage.getId())
                        .append("/content)")
                        .append("\n\n");
            }
        }
        return builder.toString();
    }

    private String replaceImagePlaceholders(String markdown,
                                            Long documentId,
                                            Map<String, DocumentParseArtifactEntity> imageArtifactMap) {
        if (markdown == null || markdown.trim().isEmpty()) {
            return "";
        }

        String resolved = markdown;
        for (Map.Entry<String, DocumentParseArtifactEntity> entry : imageArtifactMap.entrySet()) {
            String[] parts = entry.getKey().split("_");
            if (parts.length != 2) {
                continue;
            }
            String placeholder = "{{image:" + parts[0] + ":" + parts[1] + "}}";
            int pageNo = Integer.parseInt(parts[0]);
            int sequenceNo = Integer.parseInt(parts[1]);
            String imageMarkdown = "![Page " + pageNo + " Image " + sequenceNo + "](/api/documents/"
                    + documentId + "/parse-artifacts/" + entry.getValue().getId() + "/content)";
            resolved = resolved.replace(placeholder, imageMarkdown);
        }

        return resolved.replaceAll("\\{\\{image:\\d+:\\d+}}", "![Image Missing]()");
    }

    private String imageKey(int pageNo, int sequenceNo) {
        return pageNo + "_" + sequenceNo;
    }

    @Getter
    @AllArgsConstructor
    public static class ParseExecutionResult {
        private String engineCode;
        private String engineName;
        private String markdownContent;
    }
}
