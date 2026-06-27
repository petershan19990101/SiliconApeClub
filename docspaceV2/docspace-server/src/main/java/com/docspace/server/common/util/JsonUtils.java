/**
 * JSON 工具类，负责对象与字符串之间的序列化和反序列化转换。
 */
package com.docspace.server.common.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JsonUtils {

    private final ObjectMapper objectMapper;

    /** 将任意对象序列化为 JSON 字符串。 */
    public String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new IllegalStateException("JSON serialization failed", ex);
        }
    }

    /** 将 JSON 数组字符串读取为指定类型列表。 */
    public <T> List<T> readList(String value, Class<T> type) {
        if (value == null || value.trim().isEmpty()) {
            return new ArrayList<T>();
        }
        try {
            return objectMapper.readValue(value,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, type));
        } catch (Exception ex) {
            return Collections.emptyList();
        }
    }

    /** 将 JSON 字符串读取为对象，失败时返回兜底值。 */
    public <T> T readObject(String value, TypeReference<T> reference, T fallback) {
        if (value == null || value.trim().isEmpty()) {
            return fallback;
        }
        try {
            return objectMapper.readValue(value, reference);
        } catch (Exception ex) {
            return fallback;
        }
    }
}
