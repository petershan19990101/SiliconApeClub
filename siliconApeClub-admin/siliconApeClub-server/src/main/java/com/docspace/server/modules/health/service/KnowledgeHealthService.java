package com.docspace.server.modules.health.service;

import com.docspace.server.common.util.JsonUtils;
import com.docspace.server.modules.health.dto.HealthIssueUpdateRequest;
import com.docspace.server.modules.health.dto.MaintenanceWindowRequest;
import com.docspace.server.modules.knowledge.service.KnowledgeService;
import com.docspace.server.security.SecurityUser;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class KnowledgeHealthService {

    private final JdbcTemplate jdbcTemplate;
    private final JsonUtils jsonUtils;
    private final KnowledgeService knowledgeService;

    public List<Map<String, Object>> listIssues(String status) {
        if (status == null || status.trim().isEmpty()) {
            return jdbcTemplate.query(
                    "SELECT id, issue_type, severity, related_page_id, related_chunk_id, owner_id, title, description, suggested_action, " +
                            "status, detected_by, resolved_by, resolved_at, created_at, updated_at FROM ks_health_issue ORDER BY created_at DESC",
                    knowledgeService.rowMapper());
        }
        return jdbcTemplate.query(
                "SELECT id, issue_type, severity, related_page_id, related_chunk_id, owner_id, title, description, suggested_action, " +
                        "status, detected_by, resolved_by, resolved_at, created_at, updated_at FROM ks_health_issue WHERE status = ? ORDER BY created_at DESC",
                knowledgeService.rowMapper(), status);
    }

    public Map<String, Object> updateIssue(Long id, HealthIssueUpdateRequest request, SecurityUser currentUser) {
        jdbcTemplate.update(
                "UPDATE ks_health_issue SET status = COALESCE(?, status), suggested_action = COALESCE(?, suggested_action), " +
                        "resolved_by = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_by END, " +
                        "resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_at END, updated_at = ? WHERE id = ?",
                request.getStatus(),
                request.getSuggestedAction(),
                request.getStatus(),
                currentUser == null ? null : currentUser.getId(),
                request.getStatus(),
                LocalDateTime.now(),
                LocalDateTime.now(),
                id);
        return jdbcTemplate.queryForObject("SELECT * FROM ks_health_issue WHERE id = ?", knowledgeService.rowMapper(), id);
    }

    public List<Map<String, Object>> listReports() {
        return jdbcTemplate.query(
                "SELECT id, report_date, health_score, summary, metrics_json, created_by, created_at FROM ks_health_report ORDER BY report_date DESC, id DESC",
                knowledgeService.rowMapper());
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> generateReport(SecurityUser currentUser) {
        detectIssues();
        int openIssues = count("SELECT COUNT(1) FROM ks_health_issue WHERE status = 'open'");
        int failedSync = count("SELECT COUNT(1) FROM ks_sync_job WHERE status = 'failed'");
        int stalePages = count("SELECT COUNT(1) FROM ks_wiki_page WHERE sync_status IN ('stale','failed','not_indexed') AND deleted = 0");
        int activePages = count("SELECT COUNT(1) FROM ks_wiki_page WHERE status = 'active' AND deleted = 0");
        int chunks = count("SELECT COUNT(1) FROM ks_chunk WHERE knowledge_status = 'active'");
        int score = Math.max(0, 100 - openIssues * 5 - failedSync * 8 - stalePages * 3);
        Map<String, Object> metrics = new LinkedHashMap<String, Object>();
        metrics.put("openIssues", openIssues);
        metrics.put("failedSync", failedSync);
        metrics.put("stalePages", stalePages);
        metrics.put("activePages", activePages);
        metrics.put("activeChunks", chunks);
        String summary = "知识健康分 " + score + "，开放问题 " + openIssues + " 个，同步异常 " + failedSync + " 个，索引滞后页面 " + stalePages + " 个。";
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO ks_health_report(report_date, health_score, summary, metrics_json, created_by) VALUES (?, ?, ?, ?, ?) RETURNING id",
                Long.class, LocalDate.now(), score, summary, jsonUtils.toJson(metrics), currentUser == null ? null : currentUser.getId());
        return jdbcTemplate.queryForObject("SELECT id, report_date, health_score, summary, metrics_json, created_by, created_at FROM ks_health_report WHERE id = ?",
                knowledgeService.rowMapper(), id);
    }

    public Map<String, Object> getMaintenanceWindow() {
        return jdbcTemplate.queryForObject(
                "SELECT id, status, started_at, ended_at, started_by, ended_by, reason, created_at FROM ks_maintenance_window ORDER BY id DESC LIMIT 1",
                knowledgeService.rowMapper());
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> startWindow(MaintenanceWindowRequest request, SecurityUser currentUser) {
        jdbcTemplate.update("UPDATE ks_maintenance_window SET status = 'NORMAL', ended_at = COALESCE(ended_at, ?), ended_by = COALESCE(ended_by, ?) WHERE status = 'MAINTENANCE_WINDOW'",
                LocalDateTime.now(), currentUser == null ? null : currentUser.getId());
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO ks_maintenance_window(status, started_at, started_by, reason) VALUES ('MAINTENANCE_WINDOW', ?, ?, ?) RETURNING id",
                Long.class, LocalDateTime.now(), currentUser == null ? null : currentUser.getId(), request == null ? null : request.getReason());
        return jdbcTemplate.queryForObject("SELECT * FROM ks_maintenance_window WHERE id = ?", knowledgeService.rowMapper(), id);
    }

    public Map<String, Object> endWindow(SecurityUser currentUser) {
        jdbcTemplate.update("UPDATE ks_maintenance_window SET status = 'NORMAL', ended_at = ?, ended_by = ? WHERE status = 'MAINTENANCE_WINDOW' AND ended_at IS NULL",
                LocalDateTime.now(), currentUser == null ? null : currentUser.getId());
        return getMaintenanceWindow();
    }

    private void detectIssues() {
        jdbcTemplate.update(
                "INSERT INTO ks_health_issue(issue_type, severity, related_page_id, title, description, suggested_action) " +
                        "SELECT 'sync_stale', 'medium', p.id, 'Wiki 页面索引未同步: ' || p.title, '页面已发布或修改，但 RAG 索引状态为 ' || p.sync_status, '重新发布或触发同步' " +
                        "FROM ks_wiki_page p WHERE p.deleted = 0 AND p.sync_status IN ('stale','failed','not_indexed') " +
                        "AND NOT EXISTS (SELECT 1 FROM ks_health_issue i WHERE i.related_page_id = p.id AND i.issue_type = 'sync_stale' AND i.status = 'open')");
        jdbcTemplate.update(
                "INSERT INTO ks_health_issue(issue_type, severity, title, description, suggested_action) " +
                        "SELECT 'sync_failed', 'high', '知识同步任务失败 #' || j.id, COALESCE(j.error_message, '同步任务失败'), '检查同步任务错误并重试' " +
                        "FROM ks_sync_job j WHERE j.status = 'failed' " +
                        "AND NOT EXISTS (SELECT 1 FROM ks_health_issue i WHERE i.title = '知识同步任务失败 #' || j.id AND i.status = 'open')");
    }

    private int count(String sql) {
        Integer value = jdbcTemplate.queryForObject(sql, Integer.class);
        return value == null ? 0 : value;
    }
}
