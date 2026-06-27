import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { DocumentRendererProps } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

interface PdfPagePreview {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
}

/**
 * PDF 渲染器，基于 pdfjs-dist 将每一页渲染为预览图。
 */
export function PdfDocumentRenderer({ source }: DocumentRendererProps) {
  const [pages, setPages] = useState<PdfPagePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    async function renderPdf() {
      setLoading(true);
      setError(null);

      try {
        const arrayBuffer = await source.blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const nextPages: PdfPagePreview[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(1.8, 1100 / baseViewport.width);
          const viewport = page.getViewport({ scale });
          const canvas = globalThis.document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('PDF 画布初始化失败');
          }

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, canvasContext: context, viewport }).promise;

          const imageUrl = canvas.toDataURL('image/png');
          objectUrls.push(imageUrl);
          nextPages.push({
            pageNumber,
            imageUrl,
            width: viewport.width,
            height: viewport.height,
          });
        }

        if (!cancelled) {
          setPages(nextPages);
        }
      } catch {
        if (!cancelled) {
          setError('PDF 原文渲染失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void renderPdf();
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [source.blob]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        <Loader2 size={18} className="mr-2 animate-spin" />
        正在渲染 PDF...
      </div>
    );
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-rose-600">{error}</div>;
  }

  return (
    <div className="custom-scrollbar h-full overflow-auto bg-slate-100/60 p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        {pages.map((page) => (
          <div key={page.pageNumber} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-4 text-sm font-bold text-slate-500">第 {page.pageNumber} 页</p>
            <img
              src={page.imageUrl}
              alt={`PDF page ${page.pageNumber}`}
              width={page.width}
              height={page.height}
              className="mx-auto h-auto max-w-full rounded-2xl border border-slate-100"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
