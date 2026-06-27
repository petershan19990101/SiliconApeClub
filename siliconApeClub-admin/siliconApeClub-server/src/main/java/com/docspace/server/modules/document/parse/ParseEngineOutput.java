package com.docspace.server.modules.document.parse;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ParseEngineOutput {
    List<ParsePageText> pageTexts;
    List<ParseImageArtifact> images;
    String markdownContent;
}
