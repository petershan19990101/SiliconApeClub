/**
 * ToastViewport 相关文件，用于承载对应模块的实现。
 */
import React from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ToastMessage } from '../../contexts/ToastContext';
import { cx } from '../../lib/format';

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const TONE_STYLES = {
  success: {
    icon: CheckCircle2,
    container: 'border-emerald-100 bg-emerald-50/95 text-emerald-900',
    iconClass: 'text-emerald-600',
  },
  error: {
    icon: XCircle,
    container: 'border-rose-100 bg-rose-50/95 text-rose-900',
    iconClass: 'text-rose-600',
  },
  info: {
    icon: Info,
    container: 'border-blue-100 bg-blue-50/95 text-blue-900',
    iconClass: 'text-blue-600',
  },
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[140] flex w-full max-w-sm flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = TONE_STYLES[toast.tone].icon;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={cx(
                'pointer-events-auto rounded-2xl border px-4 py-4 shadow-xl backdrop-blur',
                TONE_STYLES[toast.tone].container
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className={cx('mt-0.5 shrink-0', TONE_STYLES[toast.tone].iconClass)} size={18} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{toast.title}</p>
                  {toast.description ? <p className="mt-1 text-xs opacity-80">{toast.description}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(toast.id)}
                  className="rounded-lg p-1 opacity-60 transition hover:bg-white/40 hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
