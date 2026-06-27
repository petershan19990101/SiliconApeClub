/**
 * 新建文件夹弹窗，自动继承当前用户部门，并显式展示父文件夹。
 */
import React, { useState } from 'react';
import { Building2, Folder as FolderIcon, FolderPlus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Folder } from '../types';
import { documentRepository } from '../services';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { getErrorMessage } from '../lib/errors';

interface NewFolderModalProps {
  parentFolder?: Folder | null;
  onClose: () => void;
  onCreated: () => void;
}

export function NewFolderModal({ parentFolder, onClose, onCreated }: NewFolderModalProps) {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [folderName, setFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!currentUser) {
    return null;
  }

  const currentDepartmentName = currentUser.departmentName ?? currentUser.departmentId;
  const parentFolderName = parentFolder?.name ?? '知识资产根目录';

  const handleCreate = async () => {
    const trimmedName = folderName.trim();
    if (!trimmedName) {
      return;
    }

    setIsCreating(true);

    try {
      await documentRepository.createFolder({
        name: trimmedName,
        parentId: parentFolder?.id,
        creator: currentUser,
      });
      pushToast({
        tone: 'success',
        title: '文件夹已创建',
        description: `“${trimmedName}” 已加入当前目录。`,
      });
      onCreated();
      onClose();
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '创建失败',
        description: getErrorMessage(caughtError, '文件夹创建失败'),
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
              <FolderPlus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">新建文件夹</h2>
              <p className="text-sm text-slate-500">文件夹会自动继承当前部门，并挂载到当前父文件夹下。</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-8">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">文件夹名称</label>
            <div className="relative">
              <FolderIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                autoFocus
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="输入文件夹名称..."
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">所属部门</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <Building2 size={18} className="text-slate-400" />
              <span>{currentDepartmentName}</span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">父文件夹</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <FolderIcon size={18} className="text-slate-400" />
              <span>{parentFolderName}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-8 py-4">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-200">
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !folderName.trim()}
            className="rounded-xl bg-blue-700 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? '创建中...' : '创建文件夹'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
