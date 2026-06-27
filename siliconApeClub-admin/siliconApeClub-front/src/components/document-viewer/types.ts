import { Document } from '../../types';

export type DocumentViewerKind = 'image' | 'pdf' | 'markdown' | 'video' | 'docx' | 'pptx' | 'spreadsheet' | 'unsupported';

export interface DocumentViewerSource {
  blobUrl: string;
  contentType: string;
  blob: Blob;
}

export interface DocumentRendererProps {
  document: Document;
  source: DocumentViewerSource;
}
