package com.docspace.server.modules.folder.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FolderDeleteCheckDto {

    private Long folderId;
    private String folderName;
    private boolean empty;
    private int childFolderCount;
    private int documentCount;
}
