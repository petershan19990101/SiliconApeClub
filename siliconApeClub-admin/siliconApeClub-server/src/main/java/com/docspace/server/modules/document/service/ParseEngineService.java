package com.docspace.server.modules.document.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.document.dto.ParseEngineDto;
import com.docspace.server.modules.document.parse.DocumentParseEngineRegistry;
import com.docspace.server.persistence.entity.ParseEngineBindingEntity;
import com.docspace.server.persistence.mapper.ParseEngineBindingMapper;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ParseEngineService {

    private final ParseEngineBindingMapper parseEngineBindingMapper;
    private final DocumentParseEngineRegistry documentParseEngineRegistry;

    public List<ParseEngineDto> listEnginesForFile(String fileName) {
        String extension = extractExtension(fileName);
        if (extension.isEmpty()) {
            return Collections.emptyList();
        }
        List<ParseEngineBindingEntity> bindings = listEnabledBindings(extension);
        if (bindings.isEmpty()) {
            return Collections.emptyList();
        }
        ParseEngineBindingEntity defaultBinding = resolveDefaultBinding(bindings);
        List<ParseEngineDto> engines = new ArrayList<ParseEngineDto>();
        for (ParseEngineBindingEntity binding : bindings) {
            engines.add(ParseEngineDto.builder()
                    .code(binding.getEngineCode())
                    .name(binding.getEngineName())
                    .description(documentParseEngineRegistry.getDescription(binding.getEngineCode()))
                    .supportedExtensions(Collections.singletonList(extension))
                    .defaultEngine(binding.getEngineCode().equals(defaultBinding.getEngineCode()))
                    .build());
        }
        return engines;
    }

    public EngineSelection resolveDefaultEngineForFile(String fileName) {
        return resolveEngineForFile(fileName, null);
    }

    public EngineSelection resolveEngineForFile(String fileName, String requestedEngine) {
        String extension = extractExtension(fileName);
        if (extension.isEmpty()) {
            throw new BusinessException("无法识别文件扩展名，无法选择解析引擎");
        }
        List<ParseEngineBindingEntity> bindings = listEnabledBindings(extension);
        if (bindings.isEmpty()) {
            throw new BusinessException("当前文件类型未配置解析引擎: ." + extension);
        }
        ParseEngineBindingEntity selected = null;
        if (requestedEngine == null || requestedEngine.trim().isEmpty()) {
            selected = resolveDefaultBinding(bindings);
        } else {
            for (ParseEngineBindingEntity binding : bindings) {
                if (binding.getEngineCode().equalsIgnoreCase(requestedEngine)
                        || binding.getEngineName().equals(requestedEngine)) {
                    selected = binding;
                    break;
                }
            }
        }
        if (selected == null) {
            throw new BusinessException("当前文件类型不支持所选解析引擎");
        }
        return new EngineSelection(selected.getEngineCode(), selected.getEngineName(), extension);
    }

    public boolean hasEnabledEngineForFile(String fileName) {
        String extension = extractExtension(fileName);
        if (extension.isEmpty()) {
            return false;
        }
        return !listEnabledBindings(extension).isEmpty();
    }

    public String resolveEngineName(String fileName, String requestedEngine) {
        return resolveEngineForFile(fileName, requestedEngine).getEngineName();
    }

    public String resolveDefaultEngineName(String fileName) {
        return resolveDefaultEngineForFile(fileName).getEngineName();
    }

    private List<ParseEngineBindingEntity> listEnabledBindings(String extension) {
        return parseEngineBindingMapper.selectList(new LambdaQueryWrapper<ParseEngineBindingEntity>()
                .eq(ParseEngineBindingEntity::getFileExtension, extension)
                .eq(ParseEngineBindingEntity::getEnabled, 1)
                .orderByDesc(ParseEngineBindingEntity::getIsDefault)
                .orderByAsc(ParseEngineBindingEntity::getSortOrder)
                .orderByAsc(ParseEngineBindingEntity::getId));
    }

    private ParseEngineBindingEntity resolveDefaultBinding(List<ParseEngineBindingEntity> bindings) {
        for (ParseEngineBindingEntity binding : bindings) {
            if (binding.getIsDefault() != null && binding.getIsDefault() == 1) {
                return binding;
            }
        }
        return bindings.get(0);
    }

    private String extractExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    }

    @Getter
    @AllArgsConstructor
    public static class EngineSelection {
        private String engineCode;
        private String engineName;
        private String extension;
    }
}
