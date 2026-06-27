package com.docspace.server.modules.position.dto;

import java.util.List;
import lombok.Data;

@Data
public class PositionPackageItemsRequest {
    private List<PositionPackageItemRequest> items;

    @Data
    public static class PositionPackageItemRequest {
        private String itemType;
        private Long itemId;
        private Boolean required;
        private Integer sortOrder;
    }
}
