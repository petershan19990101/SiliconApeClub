package com.docspace.server.modules.audit.service;

import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.security.SecurityUser;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditTraceService {

    private final JdbcTemplate jdbcTemplate;
    private final JsonUtils jsonUtils;
    private final KnowledgeService knowledgeService;

    public String record(SecurityUser currentUser,
                         String action,
                         String targetType,
                         Object targetId,
                         String resultStatus,
                         Map<String, Object> metadata) {
        String traceId = UUID.randomUUID().toString().replace("-", "");
        jdbcTemplate.update(
                "INSERT INTO ks_audit_trace(trace_id, actor_type, actor_id, action, target_type, target_id, result_status, metadata_json) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                traceId,
                currentUser == null ? "SYSTEM" : "USER",
                currentUser == null || currentUser.getId() == null ? null : String.valueOf(currentUser.getId()),
                action,
                targetType,
                targetId == null ? null : String.valueOf(targetId),
                resultStatus == null ? "success" : resultStatus,
                jsonUtils.toJson(metadata == null ? Collections.emptyMap() : metadata));
        return traceId;
    }

    public List<Map<String, Object>> list(String targetType, String targetId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        if (targetType != null && !targetType.trim().isEmpty() && targetId != null && !targetId.trim().isEmpty()) {
            return jdbcTemplate.query(
                    "SELECT id, trace_id, actor_type, actor_id, action, target_type, target_id, request_path, result_status, metadata_json, created_at " +
                            "FROM ks_audit_trace WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC LIMIT ?",
                    knowledgeService.rowMapper(), targetType, targetId, safeLimit);
        }
        return jdbcTemplate.query(
                "SELECT id, trace_id, actor_type, actor_id, action, target_type, target_id, request_path, result_status, metadata_json, created_at " +
                        "FROM ks_audit_trace ORDER BY created_at DESC LIMIT ?",
                knowledgeService.rowMapper(), safeLimit);
    }
}
