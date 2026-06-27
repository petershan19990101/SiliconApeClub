import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Document, DocumentVersion } from '../types';
import { VERSION_STATUS_LABELS } from '../constants';
import { formatDateTime } from '../lib/format';
import { MarkdownContent } from './markdown/MarkdownContent';

interface VersionHistoryModalProps {
  document: Document;
  versions: DocumentVersion[];
  selectedVersion: number;
  onSelectVersion: (version: DocumentVersion) => void;
  onClose: () => void;
}

export function VersionHistoryModal({
  document,
  versions,
  selectedVersion,
  onSelectVersion,
  onClose,
}: VersionHistoryModalProps) {
  const [activeVersionNo, setActiveVersionNo] = useState<number>(selectedVersion);

  useEffect(() => {
    setActiveVersionNo(selectedVersion);
  }, [selectedVersion]);

  const activeVersion = useMemo(
    () => versions.find((item) => item.version === activeVersionNo) ?? versions[0],
    [versions, activeVersionNo]
  );

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-8 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">历史版本</h2>
            <p className="text-sm text-slate-500">{document.name}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[340px_1fr]">
          <aside className="custom-scrollbar overflow-y-auto border-b border-slate-100 bg-slate-50/60 p-4 lg:border-b-0 lg:border-r">
            {versions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                暂无历史版本
              </div>
            ) : (
              <div className="space-y-2">
                {versions.map((version) => {
                  const active = activeVersionNo === version.version;
                  return (
                    <button
                      key={version.version}
                      type="button"
                      onClick={() => setActiveVersionNo(version.version)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-blue-300 bg-blue-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">V{version.version}</p>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {VERSION_STATUS_LABELS[version.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(version.timestamp)} · {version.author}
                      </p>
                      {version.summary ? <p className="mt-2 text-xs text-slate-500">{version.summary}</p> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="min-h-0 overflow-hidden bg-white">
            {!activeVersion ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">请选择一个版本查看</div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock3 size={16} className="text-slate-400" />
                    当前预览 V{activeVersion.version}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectVersion(activeVersion);
                      onClose();
                    }}
                    className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
                  >
                    切换到该版本
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <MarkdownContent
                    content={activeVersion?.parsedContent ?? ''}
                    className="custom-scrollbar h-full overflow-auto bg-slate-50/60 p-8"
                    articleClassName="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-sm"
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </div>
  );
}
