import { DocumentViewerKind } from '../components/document-viewer/types';

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
export const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov']);
export const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown']);
export const TEXT_EXTENSIONS = new Set([
  'txt',
  'text',
  'sql',
  'log',
  'json',
  'yaml',
  'yml',
  'xml',
  'properties',
  'ini',
  'conf',
  'env',
  'java',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'go',
  'sh',
  'css',
]);
export const HTML_EXTENSIONS = new Set(['html', 'htm']);
export const PDF_EXTENSIONS = new Set(['pdf']);
export const DOCX_EXTENSIONS = new Set(['docx']);
export const PPTX_EXTENSIONS = new Set(['pptx']);
export const TABLE_EXTENSIONS = new Set(['xls', 'xlsx', 'csv']);

export const SUPPORTED_UPLOAD_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...MARKDOWN_EXTENSIONS,
  ...TEXT_EXTENSIONS,
  ...HTML_EXTENSIONS,
  ...PDF_EXTENSIONS,
  ...DOCX_EXTENSIONS,
  ...PPTX_EXTENSIONS,
  ...TABLE_EXTENSIONS,
]);

export const UPLOAD_ACCEPT = [
  '.pdf',
  '.docx',
  '.pptx',
  '.xls',
  '.xlsx',
  '.csv',
  '.md',
  '.markdown',
  '.txt',
  '.text',
  '.sql',
  '.log',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.properties',
  '.ini',
  '.conf',
  '.env',
  '.java',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.go',
  '.sh',
  '.css',
  '.html',
  '.htm',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.mp4',
  '.webm',
  '.ogg',
  '.mov',
].join(',');

export function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

export function resolveViewerKindByExtension(extension: string): DocumentViewerKind {
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }
  if (PDF_EXTENSIONS.has(extension)) {
    return 'pdf';
  }
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return 'markdown';
  }
  if (TEXT_EXTENSIONS.has(extension) || HTML_EXTENSIONS.has(extension)) {
    return 'markdown';
  }
  if (DOCX_EXTENSIONS.has(extension)) {
    return 'docx';
  }
  if (PPTX_EXTENSIONS.has(extension)) {
    return 'pptx';
  }
  if (TABLE_EXTENSIONS.has(extension)) {
    return 'spreadsheet';
  }
  return 'unsupported';
}

export function validateUploadFiles(files: File[]) {
  const accepted: File[] = [];
  const rejectedMessages: string[] = [];

  files.forEach((file) => {
    const extension = getFileExtension(file.name);

    if (extension === 'doc') {
      rejectedMessages.push(`${file.name} 暂不支持 .doc，请上传 .docx 文件。`);
      return;
    }

    if (extension === 'ppt') {
      rejectedMessages.push(`${file.name} 暂不支持 .ppt，请上传 .pptx 文件。`);
      return;
    }

    if (!SUPPORTED_UPLOAD_EXTENSIONS.has(extension)) {
      rejectedMessages.push(`${file.name} 文件类型暂不支持上传。`);
      return;
    }

    accepted.push(file);
  });

  return { accepted, rejectedMessages };
}
