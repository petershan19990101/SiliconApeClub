package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("ds_parse_engine_binding")
public class ParseEngineBindingEntity {

    @TableId
    private Long id;
    private String fileExtension;
    private String engineCode;
    private String engineName;
    private Integer isDefault;
    private Integer enabled;
    private Integer sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
