/**
 * 文档版本实体，对应版本历史表。
 */
package com.docspace.server.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("ds_document_version")
public class DocumentVersionEntity {

    /** 版本记录主键。 */
    @TableId
    private Long id;
    /** 所属文档 ID。 */
    private Long documentId;
    /** 版本号。 */
    private Integer version;
    /** 源文件名称。 */
    private String sourceFileName;
    /** 版本正文内容。 */
    private String parsedContent;
    /** 解析引擎。 */
    private String engine;
    /** 作者名称。 */
    private String author;
    /** 版本状态。 */
    private String status;
    /** 版本摘要。 */
    private String summary;
    /** 创建时间。 */
    private LocalDateTime createdAt;
}
