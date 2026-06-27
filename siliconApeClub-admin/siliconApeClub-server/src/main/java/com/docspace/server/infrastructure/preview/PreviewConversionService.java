package com.docspace.server.infrastructure.preview;

import com.docspace.server.infrastructure.storage.StoredResource;
import com.docspace.server.persistence.entity.DocumentEntity;

public interface PreviewConversionService {

    boolean supports(DocumentEntity document);

    StoredResource convert(DocumentEntity document, StoredResource sourceResource);
}
