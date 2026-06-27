/**
 * NoOpCacheService 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.infrastructure.cache.impl;

import com.docspace.server.infrastructure.cache.CacheService;
import java.time.Duration;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "docspace.redis", name = "cache-enabled", havingValue = "false", matchIfMissing = true)
public class NoOpCacheService implements CacheService {

    @Override
    public Optional<String> get(String key) {
        return Optional.empty();
    }

    @Override
    public void put(String key, String value, Duration duration) {
    }

    @Override
    public void evict(String key) {
    }
}
