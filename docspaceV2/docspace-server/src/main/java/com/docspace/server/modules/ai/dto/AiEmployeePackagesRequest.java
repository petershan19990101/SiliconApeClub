package com.docspace.server.modules.ai.dto;

import java.util.List;
import lombok.Data;

@Data
public class AiEmployeePackagesRequest {
    private List<Long> packageIds;
}
