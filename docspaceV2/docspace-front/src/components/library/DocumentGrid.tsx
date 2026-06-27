import React from 'react';
import { FileText, Folder as FolderIcon, Trash2, Users } from 'lucide-react';
import { Document, Folder, User } from '../../types';
import { formatDateTime } from '../../lib/format';
import { getEffectivePermissions } from '../../lib/permissions';
import { hasSystemPermission } from '../../lib/systemPermissions';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentActions } from './DocumentActions';

interface DocumentGridProps {
  folders: Folder[];
  allFolders: Folder[];
  documents: Document[];
  currentUser: User;
  selectedFolderId?: string | null;
  busyAction?: string | null;
  onSelectFolder: (folder: Folder) => void;
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

export function DocumentGrid({
  folders,
  allFolders,
  documents,
  currentUser,
  selectedFolderId,
  busyAction,
  onSelectFolder,
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
}: DocumentGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {folders.map((folder) => {
        const permissions = getEffectivePermissions(folder, currentUser, allFolders);
        const canManagePermissions =
          hasSystemPermission(currentUser, 'folder.permission.manage') && permissions.includes('manage');
        const canDeleteFolder =
          hasSystemPermission(currentUser, 'folder.delete') && permissions.includes('delete');

        return (
          <div
            key={folder.id}
            className={`cursor-pointer rounded-3xl border bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-xl ${
              selectedFolderId === folder.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'
            }`}
            onClick={() => onSelectFolder(folder)}
            onDoubleClick={() => onOpenFolder(folder)}
          >
            <div className="mb-4 flex aspect-video items-center justify-center rounded-2xl bg-amber-50 text-amber-300">
              <FolderIcon size={42} />
            </div>
            <p className="text-base font-bold text-slate-900">{folder.name}</p>
            <p className="mt-1 text-xs text-slate-500">目录 · 创建于 {formatDateTime(folder.createdAt)}</p>

            {(canManagePermissions || canDeleteFolder) ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {canManagePermissions ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenFolderPermissions(folder);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
                  >
                    <Users size={14} />
                    管理权限
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
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {documents.map((document) => (
        <div key={document.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-xl">
          <button
            type="button"
            onClick={() => onPreviewDocument(document)}
            className="mb-4 flex aspect-video w-full items-center justify-center rounded-2xl bg-slate-50 text-blue-200 transition hover:bg-blue-50 hover:text-blue-500"
            title="查看原文件"
          >
            <FileText size={42} />
          </button>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-base font-bold text-slate-900">{document.name}</p>
              <span className="text-[10px] font-black text-slate-400">V{document.currentVersion}</span>
            </div>
            <DocumentStatusBadge document={document} compact />
            <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
              {document.parseJob.errorMessage ?? document.ragJob.errorMessage ?? document.description}
            </p>
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
          </div>
        </div>
      ))}
    </div>
  );
}
