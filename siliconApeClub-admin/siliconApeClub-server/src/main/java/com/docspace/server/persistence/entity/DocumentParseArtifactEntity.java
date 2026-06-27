package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("ds_document_parse_artifact")
public class DocumentParseArtifactEntity {

    @TableId
    private Long id;
    private Long documentId;
    private Integer version;
    private String artifactType;
    private String artifactName;
    private String mimeType;
    private Integer pageNo;
    private Integer sequenceNo;
    private String storageBucket;
    private String storageObject;
    private Long sizeBytes;
    private LocalDateTime createdAt;
}
