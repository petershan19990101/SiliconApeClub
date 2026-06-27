/**
 * 文档查询服务，负责列表、历史、搜索、统计和活动流等读取型业务。
 */
package com.docspace.server.modules.document.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.docspace.server.common.api.PageResponse;
import com.docspace.server.common.enums.DocumentStatus;
import com.docspace.server.infrastructure.cache.CacheService;
import com.docspace.server.modules.document.dto.ActivityItemDto;
import com.docspace.server.modules.document.dto.DocumentDto;
import com.docspace.server.modules.document.dto.DocumentHistoryDto;
import com.docspace.server.modules.document.dto.SearchResultDto;
import com.docspace.server.modules.document.dto.StatCardDto;
import com.docspace.server.persistence.entity.DocumentAuditEntity;
import com.docspace.server.persistence.entity.DocumentEntity;
import com.docspace.server.persistence.mapper.DocumentAuditMapper;
import com.docspace.server.persistence.mapper.DocumentMapper;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DocumentQueryService {

    private final DocumentMapper documentMapper;
    private final DocumentAuditMapper documentAuditMapper;
    private final DocumentSupportService documentSupportService;
    private final CacheService cacheService;
    private final com.docspace.server.common.util.JsonUtils jsonUtils;

    /**
     * 查询文档分页列表，支撑文档库页面和状态过滤。
     */
    /** 查询文档分页列表，支撑文档库页面和状态过滤。 */
    public PageResponse<DocumentDto> listDocuments(Long departmentId, Long folderId, String status, String query, long page, long size) {
        LambdaQueryWrapper<DocumentEntity> wrapper = new LambdaQueryWrapper<DocumentEntity>()
                .eq(DocumentEntity::getDeleted, 0)
                .orderByDesc(DocumentEntity::getUpdatedAt);
        if (departmentId != null) {
            wrapper.eq(DocumentEntity::getDepartmentId, departmentId);
        }
        if (folderId != null) {
            wrapper.eq(DocumentEntity::getFolderId, folderId);
        }
        if (status != null && !status.trim().isEmpty()) {
            wrapper.eq(DocumentEntity::getStatus, status.toUpperCase(Locale.ENGLISH));
        }
        if (query != null && !query.trim().isEmpty()) {
            wrapper.and(item -> item.like(DocumentEntity::getName, query)
                    .or().like(DocumentEntity::getDescription, query)
                    .or().like(DocumentEntity::getTagsJson, query)
                    .or().like(DocumentEntity::getLatestParsedText, query));
        }
        Page<DocumentEntity> entityPage = documentMapper.selectPage(new Page<DocumentEntity>(page, size), wrapper);
        return PageResponse.<DocumentDto>builder()
                .records(entityPage.getRecords().stream().map(documentSupportService::toDocumentDto).collect(Collectors.toList()))
                .total(entityPage.getTotal())
                .page(entityPage.getCurrent())
                .size(entityPage.getSize())
                .build();
    }

    /**
     * 查询单个文档详情。
     */
    /** 查询单个文档详情。 */
    public DocumentDto getDocument(Long id) {
        return documentSupportService.toDocumentDto(documentSupportService.getRequiredDocument(id));
    }

    /**
     * 查询文档版本历史和审计轨迹。
     */
    /** 查询文档版本历史和审计轨迹。 */
    public DocumentHistoryDto getHistory(Long id) {
        return DocumentHistoryDto.builder()
                .versions(documentSupportService.listVersions(id))
                .audits(documentSupportService.listAudits(id))
                .build();
    }

    /**
     * 生成工作台统计卡片，优先走缓存。
     */
    /** 生成工作台统计卡片，优先读取缓存。 */
    public List<StatCardDto> listStats() {
        Optional<String> cached = cacheService.get("dashboard:stats");
        if (cached.isPresent()) {
            return jsonUtils.readList(cached.get(), StatCardDto.class);
        }
        long total = documentMapper.selectCount(new LambdaQueryWrapper<DocumentEntity>().eq(DocumentEntity::getDeleted, 0));
        long pending = documentMapper.selectCount(new LambdaQueryWrapper<DocumentEntity>().eq(DocumentEntity::getDeleted, 0).eq(DocumentEntity::getStatus, DocumentStatus.PENDING_AUDIT.name()));
        long published = documentMapper.selectCount(new LambdaQueryWrapper<DocumentEntity>().eq(DocumentEntity::getDeleted, 0).eq(DocumentEntity::getStatus, DocumentStatus.PUBLISHED.name()));
        long ragReady = documentMapper.selectCount(new LambdaQueryWrapper<DocumentEntity>().eq(DocumentEntity::getDeleted, 0).in(DocumentEntity::getStatus, Arrays.asList(DocumentStatus.RAG_READY.name(), DocumentStatus.PUBLISHED.name())));
        long ratio = total == 0 ? 0 : Math.round((ragReady * 100.0) / total);
        List<StatCardDto> stats = Arrays.asList(
                StatCardDto.builder().title("总文档数").value(String.valueOf(total)).change("+0%").trend("up").subtext("当前空间内文档").icon("documents").build(),
                StatCardDto.builder().title("待审核文档").value(String.valueOf(pending)).change("+0").trend("up").subtext("等待管理员处理").icon("audit").build(),
                StatCardDto.builder().title("RAG 就绪率").value(ratio + "%").change("+0%").trend("up").subtext("已完成知识库同步").icon("rag").build(),
                StatCardDto.builder().title("已发布版本").value(String.valueOf(published)).change("+0").trend("up").subtext("正式对外可见").icon("published").build()
        );
        cacheService.put("dashboard:stats", jsonUtils.toJson(stats), Duration.ofMinutes(5));
        return stats;
    }

    /**
     * 生成最近活动流，优先走缓存。
     */
    /** 生成最近活动流，优先读取缓存。 */
    public List<ActivityItemDto> listActivities(int limit) {
        String cacheKey = "dashboard:activities:" + limit;
        Optional<String> cached = cacheService.get(cacheKey);
        if (cached.isPresent()) {
            return jsonUtils.readList(cached.get(), ActivityItemDto.class);
        }
        List<ActivityItemDto> items = documentAuditMapper.selectList(new LambdaQueryWrapper<DocumentAuditEntity>()
                        .orderByDesc(DocumentAuditEntity::getCreatedAt)
                        .last("limit " + limit))
                .stream()
                .map(documentSupportService::toActivityDto)
                .collect(Collectors.toList());
        cacheService.put(cacheKey, jsonUtils.toJson(items), Duration.ofMinutes(5));
        return items;
    }

    /**
     * 组合多维筛选条件，返回搜索结果分页。
     */
    /** 执行多条件搜索，组合关键字、部门、状态和标签筛选。 */
    public PageResponse<SearchResultDto> search(String q, List<String> departments, List<String> owners, List<String> tags, List<String> statuses, long page, long size) {
        LambdaQueryWrapper<DocumentEntity> wrapper = new LambdaQueryWrapper<DocumentEntity>()
                .eq(DocumentEntity::getDeleted, 0)
                .orderByDesc(DocumentEntity::getUpdatedAt);
        if (q != null && !q.trim().isEmpty()) {
            wrapper.and(item -> item.like(DocumentEntity::getName, q)
                    .or().like(DocumentEntity::getDescription, q)
                    .or().like(DocumentEntity::getTagsJson, q)
                    .or().like(DocumentEntity::getLatestParsedText, q));
        }
        if (departments != null && !departments.isEmpty()) {
            wrapper.in(DocumentEntity::getDepartmentId, departments.stream().map(Long::valueOf).collect(Collectors.toList()));
        }
        if (statuses != null && !statuses.isEmpty()) {
            wrapper.in(DocumentEntity::getStatus, statuses.stream().map(item -> item.toUpperCase(Locale.ENGLISH)).collect(Collectors.toList()));
        }
        Page<DocumentEntity> entityPage = documentMapper.selectPage(new Page<DocumentEntity>(page, size), wrapper);
        List<SearchResultDto> records = entityPage.getRecords().stream()
                .filter(item -> owners == null || owners.isEmpty() || owners.contains(documentSupportService.resolveUserName(item.getCreatedBy())))
                .filter(item -> tags == null || tags.isEmpty() || documentSupportService.containsAnyTag(item.getTagsJson(), tags))
                .map(documentSupportService::toSearchDto)
                .collect(Collectors.toList());
        return PageResponse.<SearchResultDto>builder()
                .records(records)
                .total(entityPage.getTotal())
                .page(entityPage.getCurrent())
                .size(entityPage.getSize())
                .build();
    }
}
