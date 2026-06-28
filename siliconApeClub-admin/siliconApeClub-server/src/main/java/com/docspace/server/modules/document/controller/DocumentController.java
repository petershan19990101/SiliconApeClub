package com.docspace.server.modules.document.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.common.api.PageResponse;
import com.docspace.server.modules.document.dto.BatchDeleteRequest;
import com.docspace.server.modules.document.dto.DocumentDto;
import com.docspace.server.modules.document.dto.DocumentHistoryDto;
import com.docspace.server.modules.document.dto.ParseEngineDto;
import com.docspace.server.modules.document.dto.PermissionUpdateRequest;
import com.docspace.server.modules.document.dto.RejectAuditRequest;
import com.docspace.server.modules.document.dto.SaveCorrectionRequest;
import com.docspace.server.modules.document.dto.StartParseRequest;
import com.docspace.server.modules.document.service.DocumentCommandService;
import com.docspace.server.modules.document.service.DocumentQueryService;
import com.docspace.server.modules.document.service.ParseEngineService;
import com.docspace.server.modules.pipeline.dto.DocumentToWikiRequest;
import com.docspace.server.modules.pipeline.service.KnowledgePipelineService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentQueryService documentQueryService;
    private final DocumentCommandService documentCommandService;
    private final ParseEngineService parseEngineService;
    private final KnowledgePipelineService knowledgePipelineService;

    @GetMapping("/documents")
    public ApiResponse<PageResponse<DocumentDto>> listDocuments(@RequestParam(required = false) Long departmentId,
                                                                @RequestParam(required = false) Long folderId,
                                                                @RequestParam(required = false) String status,
                                                                @RequestParam(required = false) String query,
                                                                @RequestParam(defaultValue = "1") long page,
                                                                @RequestParam(defaultValue = "20") long limit) {
        return ApiResponse.success(documentQueryService.listDocuments(departmentId, folderId, status, query, page, limit));
    }

    @GetMapping("/documents/{id}")
    public ApiResponse<DocumentDto> getDocument(@PathVariable Long id) {
        return ApiResponse.success(documentQueryService.getDocument(id));
    }

    @GetMapping("/documents/{id}/history")
    public ApiResponse<DocumentHistoryDto> history(@PathVariable Long id) {
        return ApiResponse.success(documentQueryService.getHistory(id));
    }

    @GetMapping("/parse-engines")
    public ApiResponse<List<ParseEngineDto>> listParseEngines(@RequestParam String fileName) {
        return ApiResponse.success(parseEngineService.listEnginesForFile(fileName));
    }

    @PostMapping("/upload")
    public ApiResponse<List<DocumentDto>> upload(@RequestPart("files") MultipartFile[] files,
                                                 @RequestParam(required = false) Long folderId,
                                                 @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentCommandService.uploadDocuments(files, folderId, currentUser));
    }

    @PutMapping("/documents/{id}/correction")
    public ApiResponse<DocumentDto> saveCorrection(@PathVariable Long id,
                                                   @Valid @RequestBody SaveCorrectionRequest request,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentCommandService.saveCorrection(id, request, currentUser));
    }

    @PostMapping("/documents/{id}/parse")
    public ApiResponse<DocumentDto> startParse(@PathVariable Long id,
                                               @RequestBody(required = false) StartParseRequest request,
                                               @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentCommandService.startParse(id, request == null ? new StartParseRequest() : request, currentUser));
    }

    @PostMapping("/documents/{id}/rag-sync")
    public ApiResponse<DocumentDto> startRagSync(@PathVariable Long id,
                                                 @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentCommandService.startRagSync(id, currentUser));
    }

    @PostMapping({"/documents/{id}/to-wiki", "/documents/{id}/generate-wiki"})
    public ApiResponse<DocumentDto> documentToWiki(@PathVariable Long id,
                                                   @RequestBody(required = false) DocumentToWikiRequest request,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        knowledgePipelineService.documentToWiki(id, request, currentUser);
        return ApiResponse.success(documentQueryService.getDocument(id));
    }

    @PostMapping("/documents/{id}/request-audit")
    public ApiResponse<DocumentDto> requestAudit(@PathVariable Long id,
                                                 @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentCommandService.requestAudit(id, currentUser));
    }

    @PostMapping("/documents/{id}/reject")
    public ApiResponse<DocumentDto> rejectAudit(@PathVariable Long id,
                                                @Valid @RequestBody RejectAuditRequest request,
                                                @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentCommandService.rejectAudit(id, request, currentUser));
    }

    @PostMapping("/documents/{id}/publish")
    public ApiResponse<DocumentDto> publish(@PathVariable Long id,
                                            @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentCommandService.publish(id, currentUser));
    }

    @PostMapping("/documents/{id}/revision")
    public ApiResponse<DocumentDto> createRevision(@PathVariable Long id,
                                                   @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentCommandService.createRevision(id, currentUser));
    }

    @PostMapping("/documents/{id}/lock")
    public ApiResponse<DocumentDto> lock(@PathVariable Long id,
                                         @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentCommandService.lock(id, currentUser));
    }

    @PostMapping("/documents/{id}/unlock")
    public ApiResponse<DocumentDto> unlock(@PathVariable Long id,
                                           @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(documentCommandService.unlock(id, currentUser));
    }

    @PutMapping("/documents/{id}/permissions")
    public ApiResponse<Void> updatePermissions(@PathVariable Long id,
                                               @Valid @RequestBody PermissionUpdateRequest request) {
        documentCommandService.updatePermissions(id, request.getAccessControl());
        return ApiResponse.success("权限更新成功", null);
    }

    @DeleteMapping("/documents/{id}")
    public ApiResponse<Void> deleteDocument(@PathVariable Long id,
                                            @AuthenticationPrincipal SecurityUser currentUser) {
        documentCommandService.deleteDocument(id, currentUser);
        return ApiResponse.success("删除成功", null);
    }

    @DeleteMapping("/documents/batch")
    public ApiResponse<Void> batchDelete(@Valid @RequestBody BatchDeleteRequest request,
                                         @AuthenticationPrincipal SecurityUser currentUser) {
        documentCommandService.batchDelete(request.getIds(), currentUser);
        return ApiResponse.success("删除成功", null);
    }
}
