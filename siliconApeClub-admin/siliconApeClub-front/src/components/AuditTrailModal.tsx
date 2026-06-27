import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { AUDIT_ACTION_LABELS } from '../constants';
import { AuditRecord, Document } from '../types';
import { formatDateTime } from '../lib/format';

interface AuditTrailModalProps {
  document: Document;
  audits: AuditRecord[];
  onClose: () => void;
}

export function AuditTrailModal({ document, audits, onClose }: AuditTrailModalProps) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-8 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">审计记录</h2>
            <p className="text-sm text-slate-500">{document.name}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50/40 p-6">
          {audits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              暂无审计记录
            </div>
          ) : (
            <div className="space-y-3">
              {audits.map((audit) => (
                <div key={audit.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-sm font-bold text-slate-900">{AUDIT_ACTION_LABELS[audit.action]}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {audit.operatorName} · {formatDateTime(audit.createdAt)} · V{audit.version}
                  </p>
                  {audit.comment ? <p className="mt-2 text-sm leading-6 text-slate-600">{audit.comment}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
