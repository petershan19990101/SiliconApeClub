/**
 * 上传文档弹窗，自动继承当前用户部门并展示当前目录。
 */
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Folder as FolderIcon, Loader2, Trash2, Upload, X } from 'lucide-react';
import { Folder } from '../types';
import { documentRepository } from '../services';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { UPLOAD_ACCEPT, validateUploadFiles } from '../lib/documentFormats';
import { getErrorMessage } from '../lib/errors';

interface UploadModalProps {
  parentFolder?: Folder | null;
  onClose: () => void;
  onUploaded: () => void;
}

interface PendingFile {
  id: string;
  file: File;
}

let uploadSequence = 0;

function createUploadId() {
  uploadSequence += 1;
  return `upload_${uploadSequence}`;
}

export function UploadModal({ parentFolder, onClose, onUploaded }: UploadModalProps) {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  if (!currentUser) {
    return null;
  }

  const currentDepartmentName = currentUser.departmentName ?? currentUser.departmentId;
  const parentFolderName = parentFolder?.name ?? '文档库根目录';

  const addFiles = (incomingFiles: File[]) => {
    const { accepted, rejectedMessages } = validateUploadFiles(incomingFiles);

    rejectedMessages.forEach((message) => {
      pushToast({
        tone: 'info',
        title: '文件已跳过',
        description: message,
      });
    });

    if (!accepted.length) {
      return;
    }

    setFiles((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: createUploadId(),
        file,
      })),
    ]);
  };

  const handleUpload = async () => {
    if (!files.length) {
      return;
    }

    setIsUploading(true);

    try {
      await documentRepository.uploadDocuments({
        files: files.map((entry) => entry.file),
        folderId: parentFolder?.id,
        uploader: currentUser,
      });

      pushToast({
        tone: 'success',
        title: '上传完成',
        description: '文档已创建，并已使用默认解析引擎完成解析。',
      });
      onUploaded();
      onClose();
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '上传失败',
        description: getErrorMessage(caughtError, '上传失败'),
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">上传文档</h2>
              <p className="text-sm text-slate-500">上传后将自动触发默认解析引擎，知识库同步需手动执行。</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-8">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(Array.from(event.dataTransfer.files));
            }}
            onClick={() => document.getElementById('library-upload-input')?.click()}
            className="cursor-pointer rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center transition hover:border-blue-300 hover:bg-blue-50/50"
          >
            <input
              id="library-upload-input"
              type="file"
              multiple
              accept={UPLOAD_ACCEPT}
              className="hidden"
              onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
            />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
              <Upload size={30} className="text-blue-700" />
            </div>
            <p className="font-bold text-slate-900">点击或拖拽文件到此处上传</p>
            <p className="mt-1 text-sm text-slate-400">支持 PDF、DOCX、PPTX、Excel、Markdown、图片与视频，暂不支持 DOC、PPT</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">归属部门</label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <Building2 size={18} className="text-slate-400" />
                <span>{currentDepartmentName}</span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">当前目录</label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <FolderIcon size={18} className="text-slate-400" />
                <span>{parentFolderName}</span>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {files.length ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">待上传文件 ({files.length})</p>
                <div className="custom-scrollbar max-h-56 space-y-3 overflow-auto pr-2">
                  {files.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{entry.file.name}</p>
                        <p className="text-[10px] text-slate-400">{(entry.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        onClick={() => setFiles((current) => current.filter((file) => file.id !== entry.id))}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-8 py-4">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-200">
            取消
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : null}
            {isUploading ? '上传中...' : '开始上传'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
