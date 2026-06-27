import React, { Suspense, lazy } from 'react';
import { ImageDocumentRenderer } from './renderers/ImageDocumentRenderer';
import { UnsupportedDocumentRenderer } from './renderers/UnsupportedDocumentRenderer';
import { VideoDocumentRenderer } from './renderers/VideoDocumentRenderer';
import { DocumentRendererProps, DocumentViewerKind } from './types';

const PdfDocumentRenderer = lazy(() =>
  import('./renderers/PdfDocumentRenderer').then((module) => ({ default: module.PdfDocumentRenderer }))
);
const MarkdownDocumentRenderer = lazy(() =>
  import('./renderers/MarkdownDocumentRenderer').then((module) => ({ default: module.MarkdownDocumentRenderer }))
);
const DocxDocumentRenderer = lazy(() =>
  import('./renderers/DocxDocumentRenderer').then((module) => ({ default: module.DocxDocumentRenderer }))
);
const PptxDocumentRenderer = lazy(() =>
  import('./renderers/PptxDocumentRenderer').then((module) => ({ default: module.PptxDocumentRenderer }))
);
const SpreadsheetDocumentRenderer = lazy(() =>
  import('./renderers/SpreadsheetDocumentRenderer').then((module) => ({ default: module.SpreadsheetDocumentRenderer }))
);

function RendererFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      正在加载渲染器...
    </div>
  );
}

/**
 * 渲染器注册表，统一分发各文档类型的预览组件。
 */
export function renderDocumentByKind(kind: DocumentViewerKind, props: DocumentRendererProps) {
  switch (kind) {
    case 'image':
      return <ImageDocumentRenderer {...props} />;
    case 'video':
      return <VideoDocumentRenderer {...props} />;
    case 'pdf':
      return (
        <Suspense fallback={<RendererFallback />}>
          <PdfDocumentRenderer {...props} />
        </Suspense>
      );
    case 'markdown':
      return (
        <Suspense fallback={<RendererFallback />}>
          <MarkdownDocumentRenderer {...props} />
        </Suspense>
      );
    case 'docx':
      return (
        <Suspense fallback={<RendererFallback />}>
          <DocxDocumentRenderer {...props} />
        </Suspense>
      );
    case 'pptx':
      return (
        <Suspense fallback={<RendererFallback />}>
          <PptxDocumentRenderer {...props} />
        </Suspense>
      );
    case 'spreadsheet':
      return (
        <Suspense fallback={<RendererFallback />}>
          <SpreadsheetDocumentRenderer {...props} />
        </Suspense>
      );
    default:
      return <UnsupportedDocumentRenderer {...props} kind={kind} />;
  }
}
