import React from 'react';
import { FileWarning } from 'lucide-react';
import { DocumentRendererProps } from '../types';
import { DocumentViewerKind } from '../types';
import { getViewerHint, getViewerKindLabel } from '../utils';

interface UnsupportedDocumentRendererProps extends DocumentRendererProps {
  kind: DocumentViewerKind;
}

/**
 * 未接入的文档类型占位渲染器，保留统一的查看入口与后续扩展点。
 */
export function UnsupportedDocumentRenderer({ document, kind }: UnsupportedDocumentRendererProps) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100/60 p-6">
      <div className="w-full max-w-xl rounded-3xl border border-dashed border-slate-300 bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <FileWarning size={28} />
        </div>
        <p className="mt-5 text-lg font-bold text-slate-900">{getViewerKindLabel(kind)}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{getViewerHint(kind)}</p>
        <p className="mt-4 text-xs text-slate-400">当前文件：{document.latestSourceFile}</p>
      </div>
    </div>
  );
}
