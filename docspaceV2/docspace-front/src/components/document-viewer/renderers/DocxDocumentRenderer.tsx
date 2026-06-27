import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { DocumentRendererProps } from '../types';
import './docx-preview.css';

const DOCX_RENDER_TIMEOUT_MS = 15000;

/**
 * DOCX 渲染器，基于 docx-preview 做更接近原文版式的浏览器预览。
 * 宿主容器会始终挂载，避免渲染阶段拿不到 DOM 导致永久卡在 loading。
 */
export function DocxDocumentRenderer({ source }: DocumentRendererProps) {
  const bodyContainerRef = useRef<HTMLDivElement | null>(null);
  const styleContainerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let timeoutId: number | null = null;

    const bodyContainer = bodyContainerRef.current;
    const styleContainer = styleContainerRef.current;

    if (!bodyContainer || !styleContainer) {
      return;
    }

    async function runRender() {
      setLoading(true);
      setError(null);
      bodyContainer.innerHTML = '';
      styleContainer.innerHTML = '';

      try {
        await Promise.race([
          renderAsync(source.blob, bodyContainer, styleContainer, {
            className: 'docx-preview',
            inWrapper: true,
            breakPages: true,
            ignoreLastRenderedPageBreak: false,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
            renderComments: false,
            useBase64URL: true,
          }),
          new Promise((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error('DOCX_RENDER_TIMEOUT')), DOCX_RENDER_TIMEOUT_MS);
          }),
        ]);

        if (!disposed) {
          setLoading(false);
        }
      } catch (caughtError) {
        if (!disposed) {
          const nextError =
            caughtError instanceof Error && caughtError.message === 'DOCX_RENDER_TIMEOUT'
              ? 'DOCX 预览超时，当前文档可能结构较复杂，请下载原文件查看。'
              : 'DOCX 原文预览失败。当前文档可能包含较复杂的版式或嵌入对象。';
          setError(nextError);
          setLoading(false);
        }
      } finally {
        if (timeoutId != null) {
          window.clearTimeout(timeoutId);
        }
      }
    }

    void runRender();

    return () => {
      disposed = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
      bodyContainer.innerHTML = '';
      styleContainer.innerHTML = '';
    };
  }, [source.blob]);

  return (
    <div className="docx-preview-surface custom-scrollbar relative h-full overflow-auto bg-slate-100/70 p-8">
      <div ref={styleContainerRef} aria-hidden="true" />
      <div ref={bodyContainerRef} className="docx-preview-host mx-auto max-w-6xl" />

      {loading ? (
        <div className="docx-preview-overlay absolute inset-0 flex items-center justify-center bg-white/72 text-sm text-slate-500 backdrop-blur-[1px]">
          <Loader2 size={18} className="mr-2 animate-spin" />
          正在渲染 DOCX...
        </div>
      ) : null}

      {error ? (
        <div className="docx-preview-overlay absolute inset-0 flex items-center justify-center bg-white/88 px-8 text-center text-sm text-rose-600">
          <div className="max-w-xl rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 shadow-sm">
            {error}
          </div>
        </div>
      ) : null}
    </div>
  );
}
