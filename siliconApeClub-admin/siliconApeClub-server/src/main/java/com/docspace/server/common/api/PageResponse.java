/**
 * PageResponse 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.common.api;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {

    private List<T> records;
    private long total;
    private long page;
    private long size;
}

