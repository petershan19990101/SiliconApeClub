import React from 'react';
import { FileText, Folder as FolderIcon, Trash2, Users } from 'lucide-react';
import { Document, Folder, User } from '../../types';
import { formatDateTime } from '../../lib/format';
import { getEffectivePermissions } from '../../lib/permissions';
import { hasSystemPermission } from '../../lib/systemPermissions';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentActions } from './DocumentActions';

interface DocumentTableProps {
  folders: Folder[];
  allFolders: Folder[];
  documents: Document[];
  currentUser: User;
  selectedIds: string[];
  selectedFolderId?: string | null;
  busyAction?: string | null;
  onSelectFolder: (folder: Folder) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onOpenDocument: (document: Document) => void;
  onPreviewDocument: (document: Document) => void;
  onOpenPermissions: (document: Document) => void;
  onOpenFolderPermissions: (folder: Folder) => void;
  onPushRag: (document: Document) => void;
  onRequestAudit: (document: Document) => void;
  onPublish: (document: Document) => void;
  onReject: (document: Document) => void;
  onCreateRevision: (document: Document) => void;
  onToggleLock: (document: Document) => void;
  onDeleteDocument: (document: Document) => void;
  onDeleteFolder: (folder: Folder) => void;
  onOpenFolder: (folder: Folder) => void;
}

export function DocumentTable({
  folders,
  allFolders,
  documents,
  currentUser,
  selectedIds,
  selectedFolderId,
  busyAction,
  onSelectFolder,
  onToggleSelect,
  onSelectAll,
  onOpenDocument,
  onPreviewDocument,
  onOpenPermissions,
  onOpenFolderPermissions,
  onPushRag,
  onRequestAudit,
  onPublish,
  onReject,
  onCreateRevision,
  onToggleLock,
  onDeleteDocument,
  onDeleteFolder,
  onOpenFolder,
}: DocumentTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
            <th className="w-12 px-4 py-4 text-center">
              <input
                type="checkbox"
                checked={documents.length > 0 && selectedIds.length === documents.length}
                onChange={onSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
              />
            </th>
            <th className="min-w-[320px] px-4 py-4">文档信息</th>
            <th className="px-4 py-4">版本</th>
            <th className="px-4 py-4">标签</th>
            <th className="px-4 py-4">状态</th>
            <th className="px-4 py-4 pr-6 text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {folders.map((folder) => {
            const permissions = getEffectivePermissions(folder, currentUser, allFolders);
            const canManagePermissions =
              hasSystemPermission(currentUser, 'folder.permission.manage') && permissions.includes('manage');
            const canDeleteFolder =
              hasSystemPermission(currentUser, 'folder.delete') && permissions.includes('delete');

            return (
              <tr
                key={folder.id}
                className={`cursor-pointer hover:bg-slate-50 ${selectedFolderId === folder.id ? 'bg-blue-50/70' : ''}`}
                onClick={() => onSelectFolder(folder)}
                onDoubleClick={() => onOpenFolder(folder)}
              >
                <td className="px-4 py-4 text-center" />
                <td className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-amber-50 p-2.5 text-amber-600">
                      <FolderIcon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{folder.name}</p>
                      <p className="mt-1 text-xs text-slate-400">目录 · 创建于 {formatDateTime(folder.createdAt)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-xs text-slate-300">-</td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">系统目录</span>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">目录</span>
                </td>
                <td className="px-4 py-4 pr-6 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {canManagePermissions ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenFolderPermissions(folder);
                        }}
                        className="rounded-lg bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                        title="目录权限"
                      >
                        <Users size={16} />
                      </button>
                    ) : null}

                    {canDeleteFolder ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteFolder(folder);
                        }}
                        disabled={busyAction === `delete-folder:${folder.id}`}
                        className="rounded-lg bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        title="删除文件夹"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}

          {documents.map((document) => (
            <tr key={document.id} className="align-top transition hover:bg-slate-50">
              <td className="px-4 py-4 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(document.id)}
                  onChange={() => onToggleSelect(document.id)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                />
              </td>
              <td className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onPreviewDocument(document)}
                    className="rounded-2xl bg-blue-50 p-2.5 text-blue-600 transition hover:bg-blue-100"
                    title="查看原文件"
                  >
                    <FileText size={20} />
                  </button>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{document.name}</p>
                      {document.isRevisionDraft ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          修订草稿
                        </span>
                      ) : null}
                    </div>
                    <p className="max-w-xl text-xs leading-relaxed text-slate-500">
                      {document.parseJob.errorMessage ?? document.ragJob.errorMessage ?? document.description}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      最后更新：{formatDateTime(document.updatedAt)}
                      {document.rejectedReason ? ` · 驳回原因：${document.rejectedReason}` : ''}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                  V{document.currentVersion}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {document.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-4">
                <DocumentStatusBadge document={document} />
              </td>
              <td className="px-4 py-4 pr-6 text-right">
                <DocumentActions
                  document={document}
                  folders={allFolders}
                  currentUser={currentUser}
                  busyAction={busyAction}
                  onOpenDocument={onOpenDocument}
                  onOpenPermissions={onOpenPermissions}
                  onPushRag={onPushRag}
                  onRequestAudit={onRequestAudit}
                  onPublish={onPublish}
                  onReject={onReject}
                  onCreateRevision={onCreateRevision}
                  onToggleLock={onToggleLock}
                  onDelete={onDeleteDocument}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
