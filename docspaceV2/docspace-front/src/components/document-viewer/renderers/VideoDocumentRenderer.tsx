import React from 'react';
import { DocumentRendererProps } from '../types';

/**
 * 视频渲染器，直接使用原生 video 标签播放。
 */
export function VideoDocumentRenderer({ source }: DocumentRendererProps) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100/60 p-6">
      <video
        src={source.blobUrl}
        controls
        className="max-h-full max-w-full rounded-2xl border border-slate-200 bg-black shadow-sm"
      />
    </div>
  );
}
