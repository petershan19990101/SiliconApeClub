package com.docspace.server.modules.document.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.infrastructure.storage.StoredResource;
import com.docspace.server.modules.document.dto.ParseArtifactDto;
import com.docspace.server.modules.document.service.DocumentParseArtifactService;
import com.docspace.server.modules.document.service.DocumentSourceService;
import com.docspace.server.security.SecurityUser;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentSourceController {

    private final DocumentSourceService documentSourceService;
    private final DocumentParseArtifactService documentParseArtifactService;

    @GetMapping("/{id}/source-file")
    public ResponseEntity<ByteArrayResource> sourceFile(@PathVariable Long id,
                                                         @AuthenticationPrincipal SecurityUser currentUser) {
        StoredResource resource = documentSourceService.loadSourceFile(id, currentUser);
        return toResponse(resource);
    }

    @GetMapping("/{id}/preview-file")
    public ResponseEntity<ByteArrayResource> previewFile(@PathVariable Long id,
                                                         @AuthenticationPrincipal SecurityUser currentUser) {
        StoredResource resource = documentSourceService.loadPreviewFile(id, currentUser);
        return toResponse(resource);
    }

    @GetMapping("/{id}/parse-artifacts")
    public ApiResponse<List<ParseArtifactDto>> listParseArtifacts(@PathVariable Long id,
                                                                  @RequestParam Integer version,
                                                                  @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentParseArtifactService.listArtifacts(id, version, currentUser));
    }

    @GetMapping("/{id}/parse-artifacts/{artifactId}/content")
    public ResponseEntity<ByteArrayResource> artifactContent(@PathVariable Long id,
                                                             @PathVariable Long artifactId,
                                                             @AuthenticationPrincipal SecurityUser currentUser) {
        StoredResource resource = documentParseArtifactService.loadArtifactContent(id, artifactId, currentUser);
        return toResponse(resource);
    }

    private ResponseEntity<ByteArrayResource> toResponse(StoredResource resource) {
        MediaType mediaType = MediaType.parseMediaType(resource.getContentType());
        ContentDisposition contentDisposition = ContentDisposition.builder("inline")
                .filename(resource.getFileName(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .body(new ByteArrayResource(resource.getContent()));
    }
}
