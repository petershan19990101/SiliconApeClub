import React, { useEffect, useMemo, useState } from 'react';
import { FileImage, FileText, Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Document, ParseArtifact } from '../types';
import { documentRepository } from '../services';
import { getErrorMessage } from '../lib/errors';

interface ParseArtifactsModalProps {
  document: Document;
  version: number;
  onClose: () => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function ParseArtifactsModal({ document, version, onClose }: ParseArtifactsModalProps) {
  const [artifacts, setArtifacts] = useState<ParseArtifact[]>([]);
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(true);
  const [artifactLoadError, setArtifactLoadError] = useState<string | null>(null);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);

  const [previewText, setPreviewText] = useState<string>('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const activeArtifact = useMemo(
    () => artifacts.find((item) => item.id === activeArtifactId) ?? null,
    [artifacts, activeArtifactId]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadArtifacts() {
      setIsLoadingArtifacts(true);
      setArtifactLoadError(null);
      setArtifacts([]);
      setActiveArtifactId(null);
      try {
        const data = await documentRepository.listParseArtifacts(document.id, version);
        if (cancelled) {
          return;
        }
        setArtifacts(data);
        if (data.length > 0) {
          setActiveArtifactId(data[0].id);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setArtifactLoadError(getErrorMessage(caughtError, '中间产物加载失败'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingArtifacts(false);
        }
      }
    }
    void loadArtifacts();
    return () => {
      cancelled = true;
    };
  }, [document.id, version]);

  useEffect(() => {
    let cancelled = false;
    let revokeUrl: string | null = null;
    async function loadPreview() {
      if (!activeArtifact) {
        setPreviewText('');
        setPreviewImageUrl(null);
        setPreviewError(null);
        return;
      }
      setIsLoadingPreview(true);
      setPreviewError(null);
      setPreviewText('');
      setPreviewImageUrl(null);
      try {
        const asset = await documentRepository.fetchParseArtifactContent(document.id, activeArtifact.id);
        if (cancelled) {
          return;
        }
        if (activeArtifact.artifactType === 'image' || asset.contentType.startsWith('image/')) {
          const objectUrl = URL.createObjectURL(asset.blob);
          revokeUrl = objectUrl;
          setPreviewImageUrl(objectUrl);
          setPreviewText('');
        } else {
          const text = await asset.blob.text();
          if (!cancelled) {
            setPreviewText(text);
            setPreviewImageUrl(null);
          }
        }
      } catch (caughtError) {
        if (!cancelled) {
          setPreviewError(getErrorMessage(caughtError, '产物内容加载失败'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPreview(false);
        }
      }
    }
    void loadPreview();
    return () => {
      cancelled = true;
      if (revokeUrl) {
        URL.revokeObjectURL(revokeUrl);
      }
    };
  }, [document.id, activeArtifact]);

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-8 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">解析中间产物</h2>
            <p className="text-sm text-slate-500">
              {document.name} · V{version}
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr]">
          <aside className="custom-scrollbar overflow-y-auto border-r border-slate-100 bg-slate-50/60 p-4">
            {isLoadingArtifacts ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-500">
                <Loader2 size={18} className="mr-2 animate-spin" />
                正在加载产物...
              </div>
            ) : artifactLoadError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {artifactLoadError}
              </div>
            ) : artifacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                当前版本暂无解析产物
              </div>
            ) : (
              <div className="space-y-2">
                {artifacts.map((artifact) => {
                  const active = activeArtifactId === artifact.id;
                  return (
                    <button
                      key={artifact.id}
                      type="button"
                      onClick={() => setActiveArtifactId(artifact.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-blue-300 bg-blue-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {artifact.artifactType === 'image' ? (
                          <FileImage size={16} className="text-slate-500" />
                        ) : (
                          <FileText size={16} className="text-slate-500" />
                        )}
                        <p className="truncate text-sm font-bold text-slate-900">{artifact.artifactName}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {artifact.artifactType.toUpperCase()}
                        {artifact.pageNo ? ` · 页 ${artifact.pageNo}` : ''}
                        {artifact.sequenceNo != null ? ` · #${artifact.sequenceNo}` : ''}
                        {` · ${formatSize(artifact.sizeBytes)}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="custom-scrollbar overflow-auto bg-white p-6">
            {!activeArtifact ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">请选择一个产物查看</div>
            ) : isLoadingPreview ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                <Loader2 size={18} className="mr-2 animate-spin" />
                正在加载产物内容...
              </div>
            ) : previewError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {previewError}
              </div>
            ) : previewImageUrl ? (
              <div className="flex h-full items-start justify-center">
                <img
                  src={previewImageUrl}
                  alt={activeArtifact.artifactName}
                  className="max-h-full max-w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
                />
              </div>
            ) : (
              <pre className="min-h-full whitespace-pre-wrap break-words rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {previewText || '（空内容）'}
              </pre>
            )}
          </section>
        </div>
      </motion.div>
    </div>
  );
}
