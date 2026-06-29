package com.docspace.server.modules.admin.service;

import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.modules.admin.dto.AiModelProfileDto;
import com.docspace.server.modules.admin.dto.AiModelProfileTestResultDto;
import com.docspace.server.modules.admin.dto.AiModelProfileUpsertRequest;
import com.docspace.server.modules.ai.service.AiModelProfileRuntimeService;
import com.docspace.server.modules.ai.service.AiModelProfileRuntimeService.ChatResult;
import com.docspace.server.modules.ai.service.AiModelProfileRuntimeService.EmbeddingResult;
import com.docspace.server.modules.ai.service.AiModelProfileRuntimeService.Profile;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AiModelProfileAdminService {

    private final JdbcTemplate jdbcTemplate;
    private final AiModelProfileRuntimeService runtimeService;
    private final PermissionAuditService permissionAuditService;
    private final JsonUtils jsonUtils;

    public List<AiModelProfileDto> listProfiles() {
        return jdbcTemplate.query(
                        "SELECT id, profile_code, profile_name, provider, purpose, endpoint, api_key, model_name, dimensions, " +
                                "timeout_seconds, enabled, default_profile, fallback_enabled, config_json, updated_at " +
                                "FROM sys_ai_model_profile ORDER BY purpose, default_profile DESC, id",
                        (rs, rowNum) -> Profile.builder()
                                .id(rs.getLong("id"))
                                .profileCode(rs.getString("profile_code"))
                                .profileName(rs.getString("profile_name"))
                                .provider(rs.getString("provider"))
                                .purpose(rs.getString("purpose"))
                                .endpoint(rs.getString("endpoint"))
                                .apiKey(rs.getString("api_key"))
                                .modelName(rs.getString("model_name"))
                                .dimensions((Integer) rs.getObject("dimensions"))
                                .timeoutSeconds(rs.getInt("timeout_seconds"))
                                .enabled(rs.getInt("enabled") == 1)
                                .defaultProfile(rs.getInt("default_profile") == 1)
                                .fallbackEnabled(rs.getInt("fallback_enabled") == 1)
                                .configJson(rs.getString("config_json"))
                                .updatedAt(rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime())
                                .build())
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(rollbackFor = Exception.class)
    public AiModelProfileDto update(Long id, AiModelProfileUpsertRequest request, SecurityUser operator) {
        Profile before = getRequired(id);
        validateRequest(request);
        String nextApiKey = request.getApiKey() == null ? before.getApiKey() : blankToNull(request.getApiKey());
        jdbcTemplate.update(
                "UPDATE sys_ai_model_profile SET profile_name = ?, provider = ?, purpose = ?, endpoint = ?, api_key = ?, " +
                        "model_name = ?, dimensions = ?, timeout_seconds = ?, enabled = ?, default_profile = ?, fallback_enabled = ?, " +
                        "config_json = ?, updated_at = ? WHERE id = ?",
                request.getProfileName().trim(),
                request.getProvider().trim(),
                request.getPurpose().trim(),
                request.getEndpoint().trim(),
                nextApiKey,
                request.getModelName().trim(),
                request.getDimensions(),
                safeTimeout(request.getTimeoutSeconds()),
                boolToInt(request.getEnabled()),
                boolToInt(request.getDefaultProfile()),
                boolToInt(request.getFallbackEnabled()),
                safeConfigJson(request.getConfigJson()),
                LocalDateTime.now(),
                id);
        if (Boolean.TRUE.equals(request.getDefaultProfile())) {
            jdbcTemplate.update("UPDATE sys_ai_model_profile SET default_profile = 0, updated_at = ? WHERE purpose = ? AND id <> ?",
                    LocalDateTime.now(), request.getPurpose().trim(), id);
        }
        permissionAuditService.record("AI_MODEL_PROFILE", id, before.getProfileCode(), "UPDATE", operator, new LinkedHashMap<String, Object>() {{
            put("purpose", request.getPurpose());
            put("provider", request.getProvider());
            put("modelName", request.getModelName());
            put("apiKeyConfigured", !isBlank(nextApiKey));
        }});
        return toDto(getRequired(id));
    }

    public AiModelProfileTestResultDto test(Long id) {
        Profile profile = getRequired(id);
        if (isBlank(profile.getApiKey())) {
            return AiModelProfileTestResultDto.builder()
                    .status("not_configured")
                    .provider(profile.getProvider())
                    .purpose(profile.getPurpose())
                    .modelName(profile.getModelName())
                    .realCall(false)
                    .fallbackUsed(false)
                    .message("API Key 未配置，未发起真实模型调用。")
                    .build();
        }
        try {
            if (AiModelProfileRuntimeService.PURPOSE_RAG_EMBEDDING.equals(profile.getPurpose())) {
                EmbeddingResult result = runtimeService.embedForRag("硅基猿猴俱乐部模型配置连通性测试");
                return AiModelProfileTestResultDto.builder()
                        .status(result.getRealCall() ? "ok" : "fallback")
                        .provider(profile.getProvider())
                        .purpose(profile.getPurpose())
                        .modelName(result.getModelName())
                        .realCall(result.getRealCall())
                        .fallbackUsed(result.getFallbackUsed())
                        .embeddingDimensions(result.getDimensions())
                        .message(result.getRealCall() ? "Embedding 模型调用成功。" : "Embedding 走了 fallback: " + result.getFallbackReason())
                        .build();
            }
            ChatResult result = runtimeService.chat(
                    profile.getPurpose(),
                    "你是硅基猿猴俱乐部的模型连通性测试助手，只返回一句中文。",
                    "请回复：模型配置测试成功。",
                    "模型配置 fallback 响应。");
            return AiModelProfileTestResultDto.builder()
                    .status(result.getRealCall() ? "ok" : "fallback")
                    .provider(profile.getProvider())
                    .purpose(profile.getPurpose())
                    .modelName(result.getModelName())
                    .realCall(result.getRealCall())
                    .fallbackUsed(result.getFallbackUsed())
                    .sample(result.getContent())
                    .message(result.getRealCall() ? "LLM 模型调用成功。" : "LLM 走了 fallback: " + result.getFallbackReason())
                    .build();
        } catch (Exception ex) {
            return AiModelProfileTestResultDto.builder()
                    .status("failed")
                    .provider(profile.getProvider())
                    .purpose(profile.getPurpose())
                    .modelName(profile.getModelName())
                    .realCall(false)
                    .fallbackUsed(false)
                    .message(ex.getMessage())
                    .build();
        }
    }

    private Profile getRequired(Long id) {
        List<Profile> profiles = jdbcTemplate.query(
                "SELECT id, profile_code, profile_name, provider, purpose, endpoint, api_key, model_name, dimensions, " +
                        "timeout_seconds, enabled, default_profile, fallback_enabled, config_json, updated_at " +
                        "FROM sys_ai_model_profile WHERE id = ?",
                (rs, rowNum) -> Profile.builder()
                        .id(rs.getLong("id"))
                        .profileCode(rs.getString("profile_code"))
                        .profileName(rs.getString("profile_name"))
                        .provider(rs.getString("provider"))
                        .purpose(rs.getString("purpose"))
                        .endpoint(rs.getString("endpoint"))
                        .apiKey(rs.getString("api_key"))
                        .modelName(rs.getString("model_name"))
                        .dimensions((Integer) rs.getObject("dimensions"))
                        .timeoutSeconds(rs.getInt("timeout_seconds"))
                        .enabled(rs.getInt("enabled") == 1)
                        .defaultProfile(rs.getInt("default_profile") == 1)
                        .fallbackEnabled(rs.getInt("fallback_enabled") == 1)
                        .configJson(rs.getString("config_json"))
                        .updatedAt(rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime())
                        .build(),
                id);
        if (profiles.isEmpty()) {
            throw new BusinessException("AI 模型配置不存在: " + id);
        }
        return profiles.get(0);
    }

    private AiModelProfileDto toDto(Profile profile) {
        return AiModelProfileDto.builder()
                .id(profile.getId())
                .profileCode(profile.getProfileCode())
                .profileName(profile.getProfileName())
                .provider(profile.getProvider())
                .purpose(profile.getPurpose())
                .endpoint(profile.getEndpoint())
                .apiKeyConfigured(!isBlank(profile.getApiKey()))
                .apiKeyMasked(mask(profile.getApiKey()))
                .modelName(profile.getModelName())
                .dimensions(profile.getDimensions())
                .timeoutSeconds(profile.getTimeoutSeconds())
                .enabled(profile.getEnabled())
                .defaultProfile(profile.getDefaultProfile())
                .fallbackEnabled(profile.getFallbackEnabled())
                .configJson(profile.getConfigJson())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }

    private void validateRequest(AiModelProfileUpsertRequest request) {
        if (isBlank(request.getProfileName()) || isBlank(request.getProvider()) || isBlank(request.getPurpose())
                || isBlank(request.getEndpoint()) || isBlank(request.getModelName())) {
            throw new BusinessException("模型配置缺少必填字段");
        }
        safeConfigJson(request.getConfigJson());
    }

    private String safeConfigJson(String value) {
        if (isBlank(value)) {
            return "{}";
        }
        try {
            jsonUtils.readObject(value, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}, new LinkedHashMap<String, Object>());
            return value.trim();
        } catch (Exception ex) {
            throw new BusinessException("扩展配置必须是合法 JSON");
        }
    }

    private Integer safeTimeout(Integer value) {
        return value == null || value < 1 ? 30 : Math.min(value, 180);
    }

    private int boolToInt(Boolean value) {
        return Boolean.TRUE.equals(value) ? 1 : 0;
    }

    private String blankToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private String mask(String apiKey) {
        if (isBlank(apiKey)) {
            return "";
        }
        String safe = apiKey.trim();
        if (safe.length() <= 8) {
            return "****";
        }
        return safe.substring(0, 4) + "****" + safe.substring(safe.length() - 4);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
