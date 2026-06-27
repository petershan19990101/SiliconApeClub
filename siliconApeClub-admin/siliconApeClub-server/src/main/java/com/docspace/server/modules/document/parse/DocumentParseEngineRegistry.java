package com.docspace.server.modules.document.parse;

import com.docspace.server.common.exception.BusinessException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DocumentParseEngineRegistry {

    private final Map<String, DocumentParseEngine> engines;

    public DocumentParseEngineRegistry(List<DocumentParseEngine> engineList) {
        this.engines = new LinkedHashMap<String, DocumentParseEngine>();
        for (DocumentParseEngine engine : engineList) {
            this.engines.put(engine.getCode(), engine);
        }
    }

    public DocumentParseEngine getRequired(String code) {
        DocumentParseEngine engine = engines.get(code);
        if (engine == null) {
            throw new BusinessException("未找到解析引擎: " + code);
        }
        return engine;
    }

    public String getDescription(String code) {
        DocumentParseEngine engine = engines.get(code);
        return engine == null ? "" : engine.getDescription();
    }

    public List<DocumentParseEngine> listEngines() {
        return new java.util.ArrayList<DocumentParseEngine>(engines.values());
    }
}
