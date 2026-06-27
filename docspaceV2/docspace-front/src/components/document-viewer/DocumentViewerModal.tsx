import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Document } from '../../types';
import { documentRepository } from '../../services';
import { getErrorMessage } from '../../lib/errors';
import { renderDocumentByKind } from './registry';
import { DocumentViewerSource } from './types';
import { getViewerHint, getViewerKindLabel, resolveViewerKind } from './utils';

interface DocumentViewerModalProps {
  document: Document;
  onClose: () => void;
}

export function DocumentViewerModal({ document, onClose }: DocumentViewerModalProps) {
  const [previewSource, setPreviewSource] = useState<DocumentViewerSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let revokedUrl: string | null = null;
    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setError(null);

      try {
        const asset = await documentRepository.fetchDocumentPreview(document.id);
        if (cancelled) {
          return;
        }

        const blobUrl = URL.createObjectURL(asset.blob);
        revokedUrl = blobUrl;
        setPreviewSource({
          blobUrl,
          contentType: asset.contentType,
          blob: asset.blob,
        });
      } catch (caughtError) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError, '预览文件加载失败'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [document.id]);

  const viewerKind = useMemo(
    () => resolveViewerKind(document, previewSource?.contentType ?? ''),
    [document, previewSource?.contentType]
  );

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const sourceAsset = await documentRepository.fetchDocumentSource(document.id);
      const downloadUrl = URL.createObjectURL(sourceAsset.blob);
      const link = globalThis.document.createElement('a');
      link.href = downloadUrl;
      link.download = document.latestSourceFile;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '原始文件加载失败'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-[90vh] w-[90vw] max-w-[1800px] flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
              <Eye size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-slate-900">原文件查看</h2>
              <p className="truncate text-sm text-slate-500">{document.latestSourceFile}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {getViewerKindLabel(viewerKind)}
            </span>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              {isDownloading ? '下载中...' : '下载原文件'}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)]">
          <aside className="custom-scrollbar overflow-auto border-r border-slate-100 bg-slate-50/70 p-5">
            <div className="space-y-5">
              <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">文件信息</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div>
                    <p className="text-xs text-slate-400">文档名称</p>
                    <p className="mt-1 font-bold text-slate-900">{document.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">原始文件</p>
                    <p className="mt-1 break-all">{document.latestSourceFile}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">当前状态</p>
                    <p className="mt-1">{document.status}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">渲染器状态</p>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">{getViewerHint(viewerKind)}</p>
              </section>
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden bg-white">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
                  <Loader2 size={18} className="animate-spin" />
                  正在加载预览文件...
                </div>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="max-w-lg rounded-3xl border border-rose-100 bg-rose-50 px-6 py-5 text-center">
                  <p className="text-base font-bold text-rose-900">预览加载失败</p>
                  <p className="mt-2 text-sm leading-relaxed text-rose-700">{error}</p>
                </div>
              </div>
            ) : previewSource ? (
              renderDocumentByKind(viewerKind, { document, source: previewSource })
            ) : null}
          </section>
        </div>
      </motion.div>
    </div>
  );
}
