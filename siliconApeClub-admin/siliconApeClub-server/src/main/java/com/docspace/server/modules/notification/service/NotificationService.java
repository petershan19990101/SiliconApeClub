package com.docspace.server.modules.notification.service;

import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final JdbcTemplate jdbcTemplate;
    private final JsonUtils jsonUtils;
    private final KnowledgeService knowledgeService;

    public Long createForUser(Long recipientId,
                              String severity,
                              String title,
                              String content,
                              Map<String, Object> metadata) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO ks_notification(recipient_type, recipient_id, severity, title, content, metadata_json) " +
                        "VALUES ('USER', ?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                recipientId == null ? null : String.valueOf(recipientId),
                severity == null ? "info" : severity,
                title,
                content,
                jsonUtils.toJson(metadata == null ? Collections.emptyMap() : metadata));
    }

    public List<Map<String, Object>> list(SecurityUser currentUser, String status, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        if (currentUser == null || currentUser.getId() == null) {
            return Collections.emptyList();
        }
        if (status != null && !status.trim().isEmpty()) {
            return jdbcTemplate.query(
                    "SELECT id, recipient_type, recipient_id, channel, severity, title, content, status, metadata_json, created_at, read_at " +
                            "FROM ks_notification WHERE recipient_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
                    knowledgeService.rowMapper(), String.valueOf(currentUser.getId()), status, safeLimit);
        }
        return jdbcTemplate.query(
                "SELECT id, recipient_type, recipient_id, channel, severity, title, content, status, metadata_json, created_at, read_at " +
                        "FROM ks_notification WHERE recipient_id = ? ORDER BY created_at DESC LIMIT ?",
                knowledgeService.rowMapper(), String.valueOf(currentUser.getId()), safeLimit);
    }

    public Map<String, Object> markRead(Long id, SecurityUser currentUser) {
        jdbcTemplate.update(
                "UPDATE ks_notification SET status = 'read', read_at = ? WHERE id = ? AND recipient_id = ?",
                LocalDateTime.now(),
                id,
                currentUser == null || currentUser.getId() == null ? null : String.valueOf(currentUser.getId()));
        return jdbcTemplate.queryForObject(
                "SELECT id, recipient_type, recipient_id, channel, severity, title, content, status, metadata_json, created_at, read_at " +
                        "FROM ks_notification WHERE id = ?",
                knowledgeService.rowMapper(), id);
    }
}
