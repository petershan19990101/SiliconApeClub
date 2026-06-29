package com.docspace.server.modules.ai.service;

import com.docspace.server.common.util.JsonUtils;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class AiModelProfileRuntimeService {

    public static final String PURPOSE_DOCUMENT_TO_WIKI = "document_to_wiki";
    public static final String PURPOSE_WORKER_CHAT = "worker_chat";
    public static final String PURPOSE_RAG_EMBEDDING = "rag_embedding";
    public static final String PURPOSE_RAG_RERANK = "rag_rerank";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final JsonUtils jsonUtils;

    public Profile getDefaultProfile(String purpose) {
        List<Profile> profiles = jdbcTemplate.query(
                "SELECT id, profile_code, profile_name, provider, purpose, endpoint, api_key, model_name, dimensions, " +
                        "timeout_seconds, enabled, default_profile, fallback_enabled, config_json, updated_at " +
                        "FROM sys_ai_model_profile WHERE purpose = ? AND enabled = 1 " +
                        "ORDER BY default_profile DESC, id ASC LIMIT 1",
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
                purpose);
        return profiles.isEmpty() ? null : profiles.get(0);
    }

    public ChatResult chat(String purpose, String systemPrompt, String userPrompt, String fallbackContent) {
        Profile profile = getDefaultProfile(purpose);
        if (profile == null) {
            return fallbackChat(null, fallbackContent, "model_profile_missing");
        }
        if (isBlank(profile.getApiKey())) {
            return fallbackChat(profile, fallbackContent, "api_key_not_configured");
        }
        try {
            Map<String, Object> config = parseConfig(profile);
            List<Map<String, String>> messages = new ArrayList<Map<String, String>>();
            messages.add(message("system", systemPrompt));
            messages.add(message("user", userPrompt));

            Map<String, Object> body = new LinkedHashMap<String, Object>();
            body.put("model", profile.getModelName());
            body.put("messages", messages);
            body.put("temperature", numberOrDefault(config.get("temperature"), 0.2d));
            body.put("max_tokens", integerOrDefault(config.get("maxTokens"), 1600));

            JsonNode root = postJson(profile, body);
            String content = root.path("choices").path(0).path("message").path("content").asText("");
            if (isBlank(content)) {
                throw new IllegalStateException("LLM response content is empty");
            }
            return ChatResult.builder()
                    .content(content.trim())
                    .provider(profile.getProvider())
                    .modelName(profile.getModelName())
                    .profileCode(profile.getProfileCode())
                    .realCall(true)
                    .fallbackUsed(false)
                    .build();
        } catch (Exception ex) {
            if (Boolean.TRUE.equals(profile.getFallbackEnabled())) {
                return fallbackChat(profile, fallbackContent, ex.getMessage());
            }
            throw new IllegalStateException("LLM call failed: " + ex.getMessage(), ex);
        }
    }

    public EmbeddingResult embedForRag(String text) {
        Profile profile = getDefaultProfile(PURPOSE_RAG_EMBEDDING);
        int dimensions = profile == null || profile.getDimensions() == null ? 1024 : profile.getDimensions();
        if (profile == null) {
            return fallbackEmbedding(text, dimensions, null, "model_profile_missing");
        }
        if (isBlank(profile.getApiKey())) {
            return fallbackEmbedding(text, dimensions, profile, "api_key_not_configured");
        }
        try {
            Map<String, Object> body = new LinkedHashMap<String, Object>();
            body.put("model", profile.getModelName());
            body.put("input", text == null ? "" : text);
            if (profile.getDimensions() != null) {
                body.put("dimensions", profile.getDimensions());
            }
            JsonNode root = postJson(profile, body);
            JsonNode vectorNode = root.path("data").path(0).path("embedding");
            List<Double> values = new ArrayList<Double>();
            if (vectorNode.isArray()) {
                for (JsonNode item : vectorNode) {
                    values.add(item.asDouble());
                }
            }
            if (values.isEmpty()) {
                throw new IllegalStateException("embedding response is empty");
            }
            return EmbeddingResult.builder()
                    .vectorLiteral(vectorLiteral(values))
                    .modelName(profile.getModelName())
                    .embeddingVersion(profile.getProvider() + ":" + profile.getProfileCode())
                    .dimensions(values.size())
                    .realCall(true)
                    .fallbackUsed(false)
                    .build();
        } catch (Exception ex) {
            if (Boolean.TRUE.equals(profile.getFallbackEnabled())) {
                return fallbackEmbedding(text, dimensions, profile, ex.getMessage());
            }
            throw new IllegalStateException("Embedding call failed: " + ex.getMessage(), ex);
        }
    }

    public Map<String, Object> profileStatus(Profile profile) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("profileCode", profile == null ? null : profile.getProfileCode());
        result.put("provider", profile == null ? null : profile.getProvider());
        result.put("modelName", profile == null ? null : profile.getModelName());
        result.put("configured", profile != null && !isBlank(profile.getApiKey()));
        result.put("fallbackEnabled", profile != null && Boolean.TRUE.equals(profile.getFallbackEnabled()));
        return result;
    }

    private JsonNode postJson(Profile profile, Map<String, Object> body) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(profile.getApiKey());
        RestTemplate restTemplate = restTemplate(profile.getTimeoutSeconds());
        ResponseEntity<String> response = restTemplate.exchange(
                profile.getEndpoint(),
                HttpMethod.POST,
                new HttpEntity<Map<String, Object>>(body, headers),
                String.class);
        return objectMapper.readTree(response.getBody());
    }

    private RestTemplate restTemplate(Integer timeoutSeconds) {
        int timeout = Math.max(1, timeoutSeconds == null ? 30 : timeoutSeconds) * 1000;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeout);
        factory.setReadTimeout(timeout);
        return new RestTemplate(factory);
    }

    private ChatResult fallbackChat(Profile profile, String fallbackContent, String reason) {
        return ChatResult.builder()
                .content(fallbackContent == null ? "" : fallbackContent)
                .provider(profile == null ? "none" : profile.getProvider())
                .modelName(profile == null ? "none" : profile.getModelName())
                .profileCode(profile == null ? null : profile.getProfileCode())
                .realCall(false)
                .fallbackUsed(true)
                .fallbackReason(reason)
                .build();
    }

    private EmbeddingResult fallbackEmbedding(String text, int dimensions, Profile profile, String reason) {
        Random random = new Random((text == null ? "" : text).hashCode());
        List<Double> values = new ArrayList<Double>();
        for (int i = 0; i < dimensions; i++) {
            values.add((random.nextDouble() - 0.5d) / 10d);
        }
        return EmbeddingResult.builder()
                .vectorLiteral(vectorLiteral(values))
                .modelName(profile == null ? "local-hash-" + dimensions : profile.getModelName())
                .embeddingVersion("fallback-local-hash-v1")
                .dimensions(dimensions)
                .realCall(false)
                .fallbackUsed(true)
                .fallbackReason(reason)
                .build();
    }

    private String vectorLiteral(List<Double> values) {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                builder.append(',');
            }
            builder.append(String.format(Locale.US, "%.6f", values.get(i)));
        }
        builder.append(']');
        return builder.toString();
    }

    private Map<String, Object> parseConfig(Profile profile) {
        return jsonUtils.readObject(profile.getConfigJson(), new TypeReference<Map<String, Object>>() {}, new LinkedHashMap<String, Object>());
    }

    private Map<String, String> message(String role, String content) {
        Map<String, String> item = new LinkedHashMap<String, String>();
        item.put("role", role);
        item.put("content", content == null ? "" : content);
        return item;
    }

    private Number numberOrDefault(Object value, Number fallback) {
        return value instanceof Number ? (Number) value : fallback;
    }

    private Integer integerOrDefault(Object value, Integer fallback) {
        return value instanceof Number ? ((Number) value).intValue() : fallback;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public String sha256(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((text == null ? "" : text).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte item : hash) {
                hex.append(String.format("%02x", item));
            }
            return hex.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("hash failed", ex);
        }
    }

    @Data
    @Builder
    public static class Profile {
        private Long id;
        private String profileCode;
        private String profileName;
        private String provider;
        private String purpose;
        private String endpoint;
        private String apiKey;
        private String modelName;
        private Integer dimensions;
        private Integer timeoutSeconds;
        private Boolean enabled;
        private Boolean defaultProfile;
        private Boolean fallbackEnabled;
        private String configJson;
        private LocalDateTime updatedAt;
    }

    @Data
    @Builder
    public static class ChatResult {
        private String content;
        private String provider;
        private String modelName;
        private String profileCode;
        private Boolean realCall;
        private Boolean fallbackUsed;
        private String fallbackReason;
    }

    @Data
    @Builder
    public static class EmbeddingResult {
        private String vectorLiteral;
        private String modelName;
        private String embeddingVersion;
        private Integer dimensions;
        private Boolean realCall;
        private Boolean fallbackUsed;
        private String fallbackReason;
    }
}
