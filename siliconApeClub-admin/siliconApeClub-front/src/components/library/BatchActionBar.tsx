/**
 * BatchActionBar 相关文件，用于承载对应模块的实现。
 */
import React from 'react';
import { Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BatchActionBarProps {
  count: number;
  onDelete: () => void;
  onClear: () => void;
}

export function BatchActionBar({ count, onDelete, onClear }: BatchActionBarProps) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-5 rounded-2xl border border-white/10 bg-slate-900/90 px-6 py-3 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-3 border-r border-white/10 pr-5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {count}
            </span>
            <span className="text-sm font-medium text-white">已选择 {count} 个文档</span>
          </div>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 text-sm font-bold text-rose-300 transition hover:text-rose-200"
          >
            <Trash2 size={16} />
            批量删除
          </button>
          <button onClick={onClear} className="rounded-lg p-1 text-slate-400 transition hover:text-white">
            <X size={18} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
