import { Document } from '../../types';
import { getFileExtension, resolveViewerKindByExtension } from '../../lib/documentFormats';
import { DocumentViewerKind } from './types';

export function resolveViewerKind(document: Document, contentType: string): DocumentViewerKind {
  const extension = getFileExtension(document.latestSourceFile);

  if (contentType.startsWith('image/')) {
    return 'image';
  }
  if (contentType.startsWith('video/')) {
    return 'video';
  }
  if (contentType.includes('pdf')) {
    return 'pdf';
  }

  return resolveViewerKindByExtension(extension);
}

export function getViewerKindLabel(kind: DocumentViewerKind) {
  switch (kind) {
    case 'image':
      return '图片预览';
    case 'video':
      return '视频预览';
    case 'pdf':
      return 'PDF 预览';
    case 'markdown':
      return 'Markdown 预览';
    case 'docx':
      return 'DOCX 预览';
    case 'pptx':
      return 'PPTX 预览';
    case 'spreadsheet':
      return 'Excel 预览';
    default:
      return '暂不支持';
  }
}

export function getViewerHint(kind: DocumentViewerKind) {
  switch (kind) {
    case 'image':
      return '当前已接入图片渲染器，可直接查看原始图片。';
    case 'video':
      return '当前已接入原生视频播放器。';
    case 'pdf':
      return '当前通过 PDF 预览链展示文档，适合稳定阅读复杂版式内容。';
    case 'markdown':
      return '当前已接入 react-markdown，可渲染 Markdown 原文。';
    case 'docx':
      return '当前基于 docx-preview 做版式预览，适合阅读与查阅普通 DOCX 文档。';
    case 'pptx':
      return '当前保留轻量 PPTX 渲染器，仅作为 PDF 预览不可用时的降级方案。';
    case 'spreadsheet':
      return '当前使用工作簿解析方案，可查看 xls、xlsx、csv 的表格内容。';
    default:
      return '当前文件类型还没有对应的前端渲染器。';
  }
}
