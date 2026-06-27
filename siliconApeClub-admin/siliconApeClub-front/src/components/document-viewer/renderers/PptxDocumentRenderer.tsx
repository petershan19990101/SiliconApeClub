import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DocumentRendererProps } from '../types';
import { extractPptxSlides, PptxSlidePreview } from '../parsers/pptx';

/**
 * PPTX 渲染器，基于轻量解析器展示每一页幻灯片中的文本与图片。
 */
export function PptxDocumentRenderer({ source }: DocumentRendererProps) {
  const [slides, setSlides] = useState<PptxSlidePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSlides() {
      setLoading(true);
      setError(null);
      try {
        const nextSlides = await extractPptxSlides(source.blob);
        if (!cancelled) {
          setSlides(nextSlides);
        }
      } catch {
        if (!cancelled) {
          setError('PPTX 原文解析失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSlides();
    return () => {
      cancelled = true;
    };
  }, [source.blob]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        <Loader2 size={18} className="mr-2 animate-spin" />
        正在解析 PPTX...
      </div>
    );
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-rose-600">{error}</div>;
  }

  return (
    <div className="custom-scrollbar h-full overflow-auto bg-slate-100/60 p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        {slides.map((slide) => (
          <section key={slide.index} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">第 {slide.index} 页</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                PPTX 轻量预览
              </span>
            </div>

            {slide.images.length ? (
              <div className="mb-5 grid gap-4 md:grid-cols-2">
                {slide.images.map((image, index) => (
                  <div key={`${slide.index}-image-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <img src={image} alt={`slide-${slide.index}-${index + 1}`} className="h-full w-full object-contain" />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-3">
              {slide.texts.length ? (
                slide.texts.map((text, index) => (
                  <p key={`${slide.index}-text-${index}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
                    {text}
                  </p>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">
                  当前页没有可提取的文本内容。
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
