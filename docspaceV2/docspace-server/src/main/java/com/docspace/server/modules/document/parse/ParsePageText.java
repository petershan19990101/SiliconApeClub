package com.docspace.server.modules.document.parse;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ParsePageText {
    int pageNo;
    String text;
}
