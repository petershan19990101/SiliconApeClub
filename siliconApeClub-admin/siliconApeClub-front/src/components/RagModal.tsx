/**
 * 知识生命周期弹窗，负责查看流水线历史并触发文档生成 LLM Wiki 与 RAG 索引。
 */
import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, X } from 'lucide-react';
import { motion } from 'motion/react';
import { AuditRecord, Document, DocumentVersion } from '../types';
import { AUDIT_ACTION_LABELS, VERSION_STATUS_LABELS } from '../constants';
import { documentRepository } from '../services';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { formatDateTime } from '../lib/format';
import { getErrorMessage } from '../lib/errors';

interface RagModalProps {
  document: Document;
  onClose: () => void;
  onUpdate: (document: Document) => void;
}

export function RagModal({ document, onClose, onUpdate }: RagModalProps) {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [versions, setVersions] = useState<DocumentVersion[]>(document.versionHistory);
  const [audits, setAudits] = useState<AuditRecord[]>(document.auditTrail);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    async function fetchHistory() {
      const history = await documentRepository.listHistory(document.id);
      setVersions(history.versions);
      setAudits(history.audits);
    }

    void fetchHistory();
  }, [document.id, document.updatedAt]);

  const handlePipeline = async () => {
    setIsRunning(true);

    try {
      const updated = await documentRepository.generateWiki(document.id, { operator: currentUser, publish: true });
      const history = await documentRepository.listHistory(document.id);
      setVersions(history.versions);
      setAudits(history.audits);
      onUpdate(updated);
      pushToast({
        tone: 'success',
        title: 'Wiki 已生成并入 RAG',
        description: '解析产物已转为 LLM Wiki，发布后完成索引，可继续提交审核。',
      });
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '知识流水线失败',
        description: getErrorMessage(caughtError, '生成 LLM Wiki 或同步 RAG 失败'),
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">知识生命周期</h2>
              <p className="text-sm text-slate-500">{document.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr]">
          <div className="border-r border-slate-100 p-8">
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-700">生命周期状态</p>
              <h3 className="mt-3 text-2xl font-bold text-slate-900">
                {document.ragJob.status === 'success' ? 'LLM Wiki 与 RAG 索引已就绪' : '等待生成 LLM Wiki'}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                最近一次流水线时间：{formatDateTime(document.ragJob.finishedAt ?? document.ragJob.updatedAt)}
              </p>
              {document.ragJob.errorMessage ? (
                <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-rose-700">{document.ragJob.errorMessage}</p>
              ) : null}
              <button
                onClick={handlePipeline}
                disabled={isRunning}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning ? <RefreshCw size={16} className="animate-spin" /> : null}
                {isRunning ? '生成中...' : document.ragJob.status === 'success' ? '重建 Wiki 入 RAG' : '生成 Wiki 入 RAG'}
              </button>
            </div>

            <div className="mt-6">
              <h3 className="mb-4 text-sm font-bold text-slate-900">版本记录</h3>
              <div className="space-y-3">
                {versions.map((version) => (
                  <div key={version.version} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-900">V{version.version}</p>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {VERSION_STATUS_LABELS[version.status]}
                        </span>
                      </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDateTime(version.timestamp)} · {version.author}
                    </p>
                    {version.summary ? <p className="mt-2 text-xs text-slate-500">{version.summary}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="custom-scrollbar max-h-[72vh] overflow-y-auto p-8">
            <h3 className="mb-4 text-sm font-bold text-slate-900">流水线与审核留痕</h3>
            <div className="space-y-3">
              {audits.map((audit) => (
                <div key={audit.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{AUDIT_ACTION_LABELS[audit.action]}</p>
                    <span className="text-[10px] text-slate-400">{formatDateTime(audit.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    操作者：{audit.operatorName} · 版本 V{audit.version}
                  </p>
                  {audit.comment ? <p className="mt-2 text-xs leading-relaxed text-slate-600">{audit.comment}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-8 py-4">
          <button onClick={onClose} className="rounded-xl bg-white px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-100">
            关闭
          </button>
        </div>
      </motion.div>
    </div>
  );
}
