import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cx } from '../../lib/format';

interface FormDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  widthClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export function FormDialog({
  isOpen,
  title,
  description,
  widthClassName = 'max-w-4xl',
  children,
  footer,
  onClose,
}: FormDialogProps) {
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
            className={cx('relative z-10 w-full overflow-hidden rounded-3xl bg-white shadow-2xl', widthClassName)}
          >
            <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="custom-scrollbar max-h-[75vh] overflow-y-auto px-6 py-6">{children}</div>
            {footer ? <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
