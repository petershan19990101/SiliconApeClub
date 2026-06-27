package com.docspace.server.modules.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.admin.dto.ParseEngineBindingAdminDto;
import com.docspace.server.modules.admin.dto.ParseEngineBindingUpsertRequest;
import com.docspace.server.modules.admin.dto.RegisteredParseEngineDto;
import com.docspace.server.modules.document.parse.DocumentParseEngine;
import com.docspace.server.modules.document.parse.DocumentParseEngineRegistry;
import com.docspace.server.persistence.entity.ParseEngineBindingEntity;
import com.docspace.server.persistence.mapper.ParseEngineBindingMapper;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ParseEngineBindingAdminService {

    private final ParseEngineBindingMapper parseEngineBindingMapper;
    private final DocumentParseEngineRegistry documentParseEngineRegistry;
    private final PermissionAuditService permissionAuditService;

    public List<RegisteredParseEngineDto> listRegisteredEngines() {
        List<RegisteredParseEngineDto> result = new ArrayList<RegisteredParseEngineDto>();
        for (DocumentParseEngine engine : documentParseEngineRegistry.listEngines()) {
            result.add(RegisteredParseEngineDto.builder()
                    .code(engine.getCode())
                    .name(engine.getName())
                    .description(engine.getDescription())
                    .build());
        }
        return result;
    }

    public List<ParseEngineBindingAdminDto> listBindings() {
        return parseEngineBindingMapper.selectList(new LambdaQueryWrapper<ParseEngineBindingEntity>()
                        .orderByAsc(ParseEngineBindingEntity::getFileExtension)
                        .orderByAsc(ParseEngineBindingEntity::getSortOrder)
                        .orderByAsc(ParseEngineBindingEntity::getId))
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(rollbackFor = Exception.class)
    public ParseEngineBindingAdminDto create(ParseEngineBindingUpsertRequest request, SecurityUser operator) {
        NormalizedBinding normalized = normalizeAndValidate(request, null);
        ParseEngineBindingEntity entity = new ParseEngineBindingEntity();
        entity.setFileExtension(normalized.getFileExtension());
        entity.setEngineCode(normalized.getEngineCode());
        entity.setEngineName(normalized.getEngineName());
        entity.setIsDefault(normalized.getDefaultBinding() ? 1 : 0);
        entity.setEnabled(normalized.getEnabled() ? 1 : 0);
        entity.setSortOrder(normalized.getSortOrder());
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        parseEngineBindingMapper.insert(entity);
        if (normalized.getDefaultBinding()) {
            clearOtherDefaults(entity.getFileExtension(), entity.getId());
        }
        permissionAuditService.record("PARSE_ENGINE_BINDING", entity.getId(), entity.getFileExtension(), "CREATE", operator, new LinkedHashMap<String, Object>() {{
            put("engineCode", entity.getEngineCode());
            put("engineName", entity.getEngineName());
            put("isDefault", entity.getIsDefault());
            put("enabled", entity.getEnabled());
            put("sortOrder", entity.getSortOrder());
        }});
        return toDto(entity);
    }

    @Transactional(rollbackFor = Exception.class)
    public ParseEngineBindingAdminDto update(Long id, ParseEngineBindingUpsertRequest request, SecurityUser operator) {
        ParseEngineBindingEntity entity = getRequiredBinding(id);
        NormalizedBinding normalized = normalizeAndValidate(request, id);
        String beforeExtension = entity.getFileExtension();
        Boolean beforeDefault = entity.getIsDefault() != null && entity.getIsDefault() == 1;

        entity.setFileExtension(normalized.getFileExtension());
        entity.setEngineCode(normalized.getEngineCode());
        entity.setEngineName(normalized.getEngineName());
        entity.setIsDefault(normalized.getDefaultBinding() ? 1 : 0);
        entity.setEnabled(normalized.getEnabled() ? 1 : 0);
        entity.setSortOrder(normalized.getSortOrder());
        entity.setUpdatedAt(LocalDateTime.now());
        parseEngineBindingMapper.updateById(entity);

        if (normalized.getDefaultBinding()) {
            clearOtherDefaults(entity.getFileExtension(), entity.getId());
        } else if (beforeDefault && !beforeExtension.equals(entity.getFileExtension())) {
            ensureOneDefaultIfMissing(beforeExtension);
        }
        ensureOneDefaultIfMissing(entity.getFileExtension());

        permissionAuditService.record("PARSE_ENGINE_BINDING", entity.getId(), entity.getFileExtension(), "UPDATE", operator, new LinkedHashMap<String, Object>() {{
            put("engineCode", entity.getEngineCode());
            put("engineName", entity.getEngineName());
            put("isDefault", entity.getIsDefault());
            put("enabled", entity.getEnabled());
            put("sortOrder", entity.getSortOrder());
        }});
        return toDto(entity);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id, SecurityUser operator) {
        ParseEngineBindingEntity entity = getRequiredBinding(id);
        String fileExtension = entity.getFileExtension();
        boolean defaultBinding = entity.getIsDefault() != null && entity.getIsDefault() == 1;
        parseEngineBindingMapper.deleteById(id);
        if (defaultBinding) {
            ensureOneDefaultIfMissing(fileExtension);
        }
        permissionAuditService.record("PARSE_ENGINE_BINDING", id, entity.getFileExtension(), "DELETE", operator, new LinkedHashMap<String, Object>() {{
            put("engineCode", entity.getEngineCode());
            put("engineName", entity.getEngineName());
        }});
    }

    private NormalizedBinding normalizeAndValidate(ParseEngineBindingUpsertRequest request, Long currentId) {
        String fileExtension = normalizeExtension(request.getFileExtension());
        if (fileExtension.isEmpty()) {
            throw new BusinessException("文件扩展名不能为空");
        }
        DocumentParseEngine engine = documentParseEngineRegistry.getRequired(request.getEngineCode().trim());
        ensureDuplicateBindingAbsent(fileExtension, engine.getCode(), currentId);
        return new NormalizedBinding(fileExtension, engine.getCode(), engine.getName(), request.getDefaultBinding(), request.getEnabled(), request.getSortOrder());
    }

    private void ensureDuplicateBindingAbsent(String fileExtension, String engineCode, Long currentId) {
        ParseEngineBindingEntity duplicate = parseEngineBindingMapper.selectOne(new LambdaQueryWrapper<ParseEngineBindingEntity>()
                .eq(ParseEngineBindingEntity::getFileExtension, fileExtension)
                .eq(ParseEngineBindingEntity::getEngineCode, engineCode)
                .ne(currentId != null, ParseEngineBindingEntity::getId, currentId)
                .last("limit 1"));
        if (duplicate != null) {
            throw new BusinessException("同一文件类型与解析引擎的绑定已存在");
        }
    }

    private void clearOtherDefaults(String fileExtension, Long keepId) {
        List<ParseEngineBindingEntity> bindings = parseEngineBindingMapper.selectList(new LambdaQueryWrapper<ParseEngineBindingEntity>()
                .eq(ParseEngineBindingEntity::getFileExtension, fileExtension)
                .eq(ParseEngineBindingEntity::getIsDefault, 1));
        for (ParseEngineBindingEntity binding : bindings) {
            if (binding.getId().equals(keepId)) {
                continue;
            }
            binding.setIsDefault(0);
            binding.setUpdatedAt(LocalDateTime.now());
            parseEngineBindingMapper.updateById(binding);
        }
    }

    private void ensureOneDefaultIfMissing(String fileExtension) {
        List<ParseEngineBindingEntity> bindings = parseEngineBindingMapper.selectList(new LambdaQueryWrapper<ParseEngineBindingEntity>()
                .eq(ParseEngineBindingEntity::getFileExtension, fileExtension)
                .orderByAsc(ParseEngineBindingEntity::getSortOrder)
                .orderByAsc(ParseEngineBindingEntity::getId));
        if (bindings.isEmpty()) {
            return;
        }
        boolean hasDefault = bindings.stream().anyMatch(binding -> binding.getIsDefault() != null && binding.getIsDefault() == 1);
        if (hasDefault) {
            return;
        }
        ParseEngineBindingEntity nextDefault = bindings.get(0);
        nextDefault.setIsDefault(1);
        nextDefault.setUpdatedAt(LocalDateTime.now());
        parseEngineBindingMapper.updateById(nextDefault);
    }

    private String normalizeExtension(String rawExtension) {
        if (rawExtension == null) {
            return "";
        }
        String normalized = rawExtension.trim().toLowerCase();
        while (normalized.startsWith(".")) {
            normalized = normalized.substring(1);
        }
        return normalized;
    }

    private ParseEngineBindingEntity getRequiredBinding(Long id) {
        ParseEngineBindingEntity entity = parseEngineBindingMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("解析引擎绑定不存在: " + id);
        }
        return entity;
    }

    private ParseEngineBindingAdminDto toDto(ParseEngineBindingEntity entity) {
        return ParseEngineBindingAdminDto.builder()
                .id(entity.getId())
                .fileExtension(entity.getFileExtension())
                .engineCode(entity.getEngineCode())
                .engineName(entity.getEngineName())
                .defaultBinding(entity.getIsDefault() != null && entity.getIsDefault() == 1)
                .enabled(entity.getEnabled() != null && entity.getEnabled() == 1)
                .sortOrder(entity.getSortOrder())
                .build();
    }

    @lombok.Getter
    @RequiredArgsConstructor
    private static class NormalizedBinding {
        private final String fileExtension;
        private final String engineCode;
        private final String engineName;
        private final Boolean defaultBinding;
        private final Boolean enabled;
        private final Integer sortOrder;
    }
}
