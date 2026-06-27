import React from 'react';
import { DocumentRendererProps } from '../types';

/**
 * 图片渲染器，直接展示原始图片内容。
 */
export function ImageDocumentRenderer({ document, source }: DocumentRendererProps) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100/60 p-6">
      <img
        src={source.blobUrl}
        alt={document.name}
        className="max-h-full max-w-full rounded-2xl border border-slate-200 bg-white object-contain shadow-sm"
      />
    </div>
  );
}
