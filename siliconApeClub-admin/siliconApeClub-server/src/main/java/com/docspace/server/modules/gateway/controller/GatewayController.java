package com.docspace.server.modules.gateway.controller;

import com.docspace.server.common.api.ApiResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/gateway")
public class GatewayController {

    @GetMapping("/service-map")
    public ApiResponse<List<Map<String, Object>>> serviceMap() {
        List<Map<String, Object>> services = new ArrayList<Map<String, Object>>();
        services.add(service("API Gateway", "siliconapeclub-server", "/api/**", "Spring MVC + SecurityConfig merged gateway"));
        services.add(service("Auth & IAM Service", "siliconapeclub-server", "/api/auth/**,/api/admin/**,/api/users/**,/api/departments/**", "User, role, department, JWT and RBAC"));
        services.add(service("Doc Service", "siliconapeclub-server", "/api/upload,/api/documents/**", "Admin upload, source files, versions and parse artifacts"));
        services.add(service("Wiki Service", "siliconapeclub-server", "/api/wiki/**", "LLM Wiki pages, versions and publish flow"));
        services.add(service("Knowledge Pipeline Worker", "knowledge-pipeline-worker + siliconapeclub-server", "/api/pipeline/**,/api/knowledge-pipeline/**", "Parsed document to LLM Wiki pipeline"));
        services.add(service("Knowledge Index Service", "knowledge-pipeline-worker + retrieval-service", "/api/pipeline/**,/api/retrieval/sync/**,/api/knowledge/**", "Sync ledger, chunk and embedding index"));
        services.add(service("Retrieval Service", "retrieval-service", "/api/retrieval/**", "RAG search, management replay, rerank and citation callback"));
        services.add(service("Knowledge Runtime Service", "knowledge-runtime-service", "/api/ai-employees/**,/api/wiki/proposals/**", "AI runtime context and Wiki proposal review"));
        services.add(service("Task Memory Service", "task-memory-service", "/api/task-memories/**", "AI task memory and Wiki proposal promotion"));
        services.add(service("Position Knowledge Service", "siliconapeclub-server", "/api/position-packages/**", "Position knowledge management and AI employee bindings"));
        services.add(service("Knowledge Health Service", "siliconapeclub-server", "/api/knowledge-health/**", "Health issues, reports and maintenance window"));
        services.add(service("Audit Trace Service", "siliconapeclub-server", "/api/audit-traces/**,/api/knowledge/citations", "Audit traces, citation logs and replay anchors"));
        services.add(service("Notification Service", "siliconapeclub-server", "/api/notifications/**", "In-app notifications for reviews and pipeline outcomes"));
        return ApiResponse.success(services);
    }

    private Map<String, Object> service(String logicalService, String physicalProcess, String routes, String responsibility) {
        Map<String, Object> item = new LinkedHashMap<String, Object>();
        item.put("logicalService", logicalService);
        item.put("physicalProcess", physicalProcess);
        item.put("routes", routes);
        item.put("responsibility", responsibility);
        return item;
    }
}
