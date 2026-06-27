/**
 * ConfirmDialog 相关文件，用于承载对应模块的实现。
 */
import React, { ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cx } from '../../lib/format';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = '取消',
  tone = 'default',
  busy = false,
  confirmDisabled = false,
  children,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label="关闭"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-start gap-3">
                <div
                  className={cx(
                    'rounded-2xl p-3',
                    tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                  )}
                >
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            {children ? <div className="px-6 py-5">{children}</div> : null}
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy || confirmDisabled}
                className={cx(
                  'rounded-xl px-5 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50',
                  tone === 'danger' ? 'bg-rose-600 hover:brightness-110' : 'bg-slate-900 hover:brightness-110'
                )}
              >
                {busy ? '处理中...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
