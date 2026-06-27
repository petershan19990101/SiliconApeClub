/**
 * CacheService 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.infrastructure.cache;

import java.time.Duration;
import java.util.Optional;

public interface CacheService {

    Optional<String> get(String key);

    void put(String key, String value, Duration duration);

    void evict(String key);
}
