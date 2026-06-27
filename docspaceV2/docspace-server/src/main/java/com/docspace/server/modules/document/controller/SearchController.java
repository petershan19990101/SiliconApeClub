/**
 * SearchController 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.document.controller;

import com.docspace.server.common.api.ApiResponse;
import com.docspace.server.common.api.PageResponse;
import com.docspace.server.modules.document.dto.SearchResultDto;
import com.docspace.server.modules.document.service.DocumentQueryService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final DocumentQueryService documentQueryService;

    @GetMapping
    public ApiResponse<PageResponse<SearchResultDto>> search(@RequestParam(defaultValue = "") String q,
                                                             @RequestParam(required = false) List<String> departments,
                                                             @RequestParam(required = false) List<String> owners,
                                                             @RequestParam(required = false) List<String> tags,
                                                             @RequestParam(required = false) List<String> statuses,
                                                             @RequestParam(defaultValue = "1") long page,
                                                             @RequestParam(defaultValue = "20") long limit) {
        return ApiResponse.success(documentQueryService.search(q, departments, owners, tags, statuses, page, limit));
    }
}
