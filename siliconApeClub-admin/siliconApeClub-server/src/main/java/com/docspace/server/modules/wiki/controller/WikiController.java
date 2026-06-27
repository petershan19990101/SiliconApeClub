package com.docspace.server.modules.wiki.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.modules.wiki.dto.WikiPageRequest;
import com.docspace.server.modules.wiki.dto.WikiRelationRequest;
import com.docspace.server.modules.wiki.service.WikiService;
import com.docspace.server.security.SecurityUser;
import java.util.List;
import java.util.Map;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/wiki")
@RequiredArgsConstructor
public class WikiController {

    private final WikiService wikiService;

    @GetMapping("/structure")
    public ApiResponse<Map<String, Object>> structure(@RequestParam(required = false) String groupBy,
                                                      @RequestParam(required = false) String query,
                                                      @RequestParam(required = false) String status) {
        return ApiResponse.success(wikiService.structure(groupBy, query, status));
    }

    @GetMapping("/pages")
    public ApiResponse<List<Map<String, Object>>> listPages(@RequestParam(required = false) String status,
                                                            @RequestParam(required = false) String query,
                                                            @RequestParam(required = false) Long departmentId,
                                                            @RequestParam(required = false) String pageType) {
        return ApiResponse.success(wikiService.listPages(status, query, departmentId, pageType));
    }

    @PostMapping("/pages")
    public ApiResponse<Map<String, Object>> createPage(@Valid @RequestBody WikiPageRequest request,
                                                       @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(wikiService.createPage(request, currentUser));
    }

    @GetMapping("/pages/{id}")
    public ApiResponse<Map<String, Object>> getPage(@PathVariable Long id) {
        return ApiResponse.success(wikiService.getPage(id));
    }

    @PutMapping("/pages/{id}")
    public ApiResponse<Map<String, Object>> updatePage(@PathVariable Long id,
                                                       @Valid @RequestBody WikiPageRequest request,
                                                       @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(wikiService.updatePage(id, request, currentUser));
    }

    @PostMapping("/pages/{id}/publish")
    public ApiResponse<Map<String, Object>> publish(@PathVariable Long id,
                                                    @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(wikiService.publish(id, currentUser));
    }

    @PostMapping("/pages/{id}/archive")
    public ApiResponse<Map<String, Object>> archive(@PathVariable Long id,
                                                    @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(wikiService.archive(id, currentUser));
    }

    @DeleteMapping("/pages/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id,
                                    @AuthenticationPrincipal SecurityUser currentUser) {
        wikiService.delete(id, currentUser);
        return ApiResponse.success(null);
    }

    @GetMapping("/pages/{id}/versions")
    public ApiResponse<List<Map<String, Object>>> versions(@PathVariable Long id) {
        return ApiResponse.success(wikiService.listVersions(id));
    }

    @GetMapping("/pages/{id}/sync-status")
    public ApiResponse<Map<String, Object>> syncStatus(@PathVariable Long id) {
        return ApiResponse.success(wikiService.syncStatus(id));
    }

    @GetMapping("/pages/{id}/relations")
    public ApiResponse<List<Map<String, Object>>> relations(@PathVariable Long id) {
        return ApiResponse.success(wikiService.listRelations(id));
    }

    @PostMapping("/pages/{id}/relations")
    public ApiResponse<Map<String, Object>> createRelation(@PathVariable Long id,
                                                           @Valid @RequestBody WikiRelationRequest request,
                                                           @AuthenticationPrincipal SecurityUser currentUser) {
        return ApiResponse.success(wikiService.createRelation(id, request, currentUser));
    }

    @DeleteMapping("/pages/{id}/relations/{relationId}")
    public ApiResponse<Void> deleteRelation(@PathVariable Long id,
                                            @PathVariable Long relationId,
                                            @AuthenticationPrincipal SecurityUser currentUser) {
        wikiService.deleteRelation(id, relationId, currentUser);
        return ApiResponse.success(null);
    }
}
