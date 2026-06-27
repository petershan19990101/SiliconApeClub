package com.docspace.server.modules.document.parse;

public interface DocumentParseEngine {

    String getCode();

    String getName();

    String getDescription();

    ParseEngineOutput parse(byte[] sourceBytes);
}
