package com.docspace.server.modules.knowledge.service;

import com.docspace.server.common.exception.BusinessException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class RetrievalProxyService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${docspace.retrieval.base-url:http://localhost:8090}")
    private String retrievalBaseUrl;

    @SuppressWarnings("unchecked")
    public Map<String, Object> debug(Map<String, Object> request) {
        String url = trimTrailingSlash(retrievalBaseUrl) + "/api/retrieval/debug";
        try {
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
            if (response == null) {
                throw new BusinessException("Retrieval 服务未返回调试结果");
            }
            return response;
        } catch (RestClientException ex) {
            throw new BusinessException("RAG 管理台调用失败: " + ex.getMessage());
        }
    }

    private String trimTrailingSlash(String value) {
        if (value == null || value.trim().isEmpty()) {
            return "http://localhost:8090";
        }
        String result = value.trim();
        while (result.endsWith("/")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }
}
