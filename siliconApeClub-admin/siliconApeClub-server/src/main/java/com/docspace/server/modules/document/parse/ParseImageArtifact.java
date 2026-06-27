package com.docspace.server.modules.document.parse;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ParseImageArtifact {
    int pageNo;
    int sequenceNo;
    byte[] content;
    String mimeType;
    String extension;
}
