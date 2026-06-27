/**
 * RedisCacheService 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.infrastructure.cache.impl;

import com.docspace.server.config.properties.DocspaceRedisProperties;
import com.docspace.server.infrastructure.cache.CacheService;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "docspace.redis", name = "cache-enabled", havingValue = "true")
public class RedisCacheService implements CacheService {

    private final StringRedisTemplate stringRedisTemplate;
    private final DocspaceRedisProperties properties;

    @Override
    public Optional<String> get(String key) {
        String value = stringRedisTemplate.opsForValue().get(key);
        if (value == null || value.trim().isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(value);
    }

    @Override
    public void put(String key, String value, Duration duration) {
        Duration ttl = duration == null ? Duration.ofSeconds(properties.getCacheTtlSeconds()) : duration;
        stringRedisTemplate.opsForValue().set(key, value, ttl);
    }

    @Override
    public void evict(String key) {
        stringRedisTemplate.delete(key);
    }
}
