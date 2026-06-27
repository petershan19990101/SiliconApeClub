import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Document, Folder } from '../types';
import { documentRepository } from '../services';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { UploadModal } from './UploadModal';
import { NewFolderModal } from './NewFolderModal';
import { PermissionModal } from './PermissionModal';
import { ParsingModal } from './ParsingModal';
import { RagModal } from './RagModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { DocumentViewerModal } from './document-viewer/DocumentViewerModal';
import { LibraryToolbar } from './library/LibraryToolbar';
import { DocumentTable } from './library/DocumentTable';
import { DocumentGrid } from './library/DocumentGrid';
import { BatchActionBar } from './library/BatchActionBar';
import { getErrorMessage } from '../lib/errors';

type PermissionModalItem =
  | { type: 'document'; item: Document }
  | { type: 'folder'; item: Folder };

type FolderDeleteBlockedState = {
  folder: Folder;
  childFolderCount: number;
  documentCount: number;
};

export function Library() {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [activeRagDocument, setActiveRagDocument] = useState<Document | null>(null);
  const [permissionModalItem, setPermissionModalItem] = useState<PermissionModalItem | null>(null);
  const [rejectDocument, setRejectDocument] = useState<Document | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteDocumentTarget, setDeleteDocumentTarget] = useState<Document | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [blockedFolderDeletion, setBlockedFolderDeletion] = useState<FolderDeleteBlockedState | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLibraryData(query = searchQuery, folderId = currentFolderId) {
    setLoading(true);
    setError(null);

    try {
      const [documentResponse, folderResponse] = await Promise.all([
        documentRepository.listDocuments({
          folderId: folderId ?? undefined,
          query: query.trim() || undefined,
          limit: 200,
        }),
        documentRepository.listFolders(),
      ]);

      const filteredDocuments = documentResponse.documents.filter((document) =>
        folderId ? document.folderId === folderId : !document.folderId
      );

      setDocuments(filteredDocuments);
      setFolders(folderResponse.folders);
      setSelectedIds((current) => current.filter((id) => filteredDocuments.some((document) => document.id === id)));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '知识资产加载失败'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      void loadLibraryData(searchQuery, currentFolderId);
    }, 150);

    return () => globalThis.clearTimeout(timeout);
  }, [searchQuery, currentFolderId]);

  const visibleFolders = folders.filter((folder) => {
    const inCurrentFolder = currentFolderId ? folder.parentId === currentFolderId : !folder.parentId;
    const matchesSearch = searchQuery.trim() ? folder.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    return inCurrentFolder && matchesSearch;
  });

  const currentFolderPath = currentFolderId
    ? (() => {
        const path: Folder[] = [];
        let current = folders.find((folder) => folder.id === currentFolderId);
        while (current) {
          path.unshift(current);
          current = current.parentId ? folders.find((folder) => folder.id === current?.parentId) : undefined;
        }
        return path;
      })()
    : [];
  const currentFolder = currentFolderPath[currentFolderPath.length - 1] ?? null;

  const removeDocumentFromState = (documentId: string) => {
    setDocuments((current) => current.filter((document) => document.id !== documentId));
    setSelectedIds((current) => current.filter((id) => id !== documentId));
    if (activeDocument?.id === documentId) {
      setActiveDocument(null);
    }
    if (previewDocument?.id === documentId) {
      setPreviewDocument(null);
    }
    if (activeRagDocument?.id === documentId) {
      setActiveRagDocument(null);
    }
    if (permissionModalItem?.type === 'document' && permissionModalItem.item.id === documentId) {
      setPermissionModalItem(null);
    }
  };

  const handleOpenFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setSelectedIds([]);
    setSelectedFolderId(folder.id);
  };

  const handleNavigateRoot = () => {
    setCurrentFolderId(null);
    setSelectedIds([]);
    setSelectedFolderId(null);
  };

  const handleNavigateFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setSelectedIds([]);
    setSelectedFolderId(folderId);
  };

  const updateDocument = (updatedDocument: Document) => {
    setDocuments((current) => current.map((document) => (document.id === updatedDocument.id ? updatedDocument : document)));
    if (activeDocument?.id === updatedDocument.id) {
      setActiveDocument(updatedDocument);
    }
    if (activeRagDocument?.id === updatedDocument.id) {
      setActiveRagDocument(updatedDocument);
    }
  };

  const handleAction = async (
    key: string,
    action: () => Promise<Document>,
    success: { title: string; description: string }
  ) => {
    setBusyAction(key);

    try {
      const updated = await action();
      updateDocument(updated);
      pushToast({
        tone: 'success',
        ...success,
      });
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '操作失败',
        description: getErrorMessage(caughtError, '操作失败'),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRequestAudit = async (document: Document) => {
    await handleAction(`submit:${document.id}`, () => documentRepository.requestAudit(document.id, { operator: currentUser }), {
      title: '已提交审核',
      description: `“${document.name}” 正等待管理员审核。`,
    });
  };

  const handlePublish = async (document: Document) => {
    await handleAction(`publish:${document.id}`, () => documentRepository.publish(document.id, { operator: currentUser }), {
      title: '文档已发布',
      description: `“${document.name}” 已正式进入知识库。`,
    });
  };

  const handleCreateRevision = async (document: Document) => {
    setBusyAction(`revision:${document.id}`);

    try {
      const draft = await documentRepository.createRevision(document.id, { operator: currentUser });
      setDocuments((current) =>
        current.some((item) => item.id === draft.id)
          ? current.map((item) => (item.id === draft.id ? draft : item))
          : [draft, ...current]
      );
      setActiveDocument(draft);
      pushToast({
        tone: 'success',
        title: '修订草稿已创建',
        description: `已基于“${document.name}”创建新的修订版本。`,
      });
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '创建修订失败',
        description: getErrorMessage(caughtError, '创建修订失败'),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleLock = async (document: Document) => {
    const action = document.status === 'locked' ? documentRepository.unlockDocument : documentRepository.lockDocument;
    const actionName = document.status === 'locked' ? '解除锁定' : '锁定版本';

    await handleAction(`lock:${document.id}`, () => action(document.id, { operator: currentUser }), {
      title: actionName,
      description: `“${document.name}” 已${actionName}。`,
    });
  };

  const handleRejectConfirm = async () => {
    if (!rejectDocument) {
      return;
    }

    setBusyAction(`reject:${rejectDocument.id}`);

    try {
      const updated = await documentRepository.rejectAudit(rejectDocument.id, rejectReason, { operator: currentUser });
      updateDocument(updated);
      pushToast({
        tone: 'success',
        title: '已驳回审核',
        description: `“${rejectDocument.name}” 已退回修改。`,
      });
      setRejectDocument(null);
      setRejectReason('');
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '驳回失败',
        description: getErrorMessage(caughtError, '驳回失败'),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleBatchDelete = async () => {
    setBusyAction('batch-delete');

    try {
      await documentRepository.batchDeleteDocuments(selectedIds);
      setDocuments((current) => current.filter((document) => !selectedIds.includes(document.id)));
      setSelectedIds([]);
      setIsDeleteConfirmOpen(false);
      pushToast({
        tone: 'success',
        title: '批量删除完成',
        description: '选中的文档已从当前列表中移除。',
      });
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '删除失败',
        description: getErrorMessage(caughtError, '删除失败'),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteDocumentConfirm = async () => {
    if (!deleteDocumentTarget) {
      return;
    }

    setBusyAction(`delete:${deleteDocumentTarget.id}`);

    try {
      await documentRepository.deleteDocument(deleteDocumentTarget.id);
      removeDocumentFromState(deleteDocumentTarget.id);
      pushToast({
        tone: 'success',
        title: '文档已删除',
        description: `“${deleteDocumentTarget.name}” 已从当前列表移除。`,
      });
      setDeleteDocumentTarget(null);
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '删除失败',
        description: getErrorMessage(caughtError, '删除失败'),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteFolderRequest = async (folder: Folder) => {
    setBusyAction(`delete-folder:${folder.id}`);

    try {
      const check = await documentRepository.getFolderDeleteCheck(folder.id);
      if (!check.empty) {
        setBlockedFolderDeletion({
          folder,
          childFolderCount: check.childFolderCount,
          documentCount: check.documentCount,
        });
        return;
      }

      setDeleteFolderTarget(folder);
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '删除检查失败',
        description: getErrorMessage(caughtError, '删除检查失败'),
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteFolderConfirm = async () => {
    if (!deleteFolderTarget) {
      return;
    }

    setBusyAction(`delete-folder:${deleteFolderTarget.id}`);

    try {
      await documentRepository.deleteFolder(deleteFolderTarget.id);
      setFolders((current) => current.filter((folder) => folder.id !== deleteFolderTarget.id));
      if (currentFolderId === deleteFolderTarget.id) {
        setCurrentFolderId(deleteFolderTarget.parentId ?? null);
      }
      if (selectedFolderId === deleteFolderTarget.id) {
        setSelectedFolderId(deleteFolderTarget.parentId ?? null);
      }
      if (permissionModalItem?.type === 'folder' && permissionModalItem.item.id === deleteFolderTarget.id) {
        setPermissionModalItem(null);
      }
      pushToast({
        tone: 'success',
        title: '文件夹已删除',
        description: `“${deleteFolderTarget.name}” 已删除。`,
      });
      setDeleteFolderTarget(null);
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '删除失败',
        description: getErrorMessage(caughtError, '删除失败'),
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
      <LibraryToolbar
        viewMode={viewMode}
        searchQuery={searchQuery}
        itemCount={visibleFolders.length + documents.length}
        currentFolderPath={currentFolderPath}
        currentUser={currentUser}
        onSearchChange={setSearchQuery}
        onViewModeChange={setViewMode}
        onUpload={() => setIsUploadModalOpen(true)}
        onNewFolder={() => setIsNewFolderModalOpen(true)}
        onNavigateRoot={handleNavigateRoot}
        onNavigateFolder={handleNavigateFolder}
      />

      <div className="custom-scrollbar flex-1 overflow-auto px-8 py-5">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-700" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 p-8 text-rose-900">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} />
              <h2 className="text-lg font-bold">知识资产加载失败</h2>
            </div>
            <p className="mt-2 text-sm text-rose-700">{error}</p>
          </div>
        ) : documents.length === 0 && visibleFolders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-8 py-14 text-center">
            <p className="text-lg font-bold text-slate-900">还没有匹配的文档</p>
            <p className="mt-2 text-sm text-slate-500">试着上传一份文档，或者换一个搜索关键词。</p>
          </div>
        ) : viewMode === 'list' ? (
          <DocumentTable
            folders={visibleFolders}
            allFolders={folders}
            documents={documents}
            currentUser={currentUser}
            selectedIds={selectedIds}
            selectedFolderId={selectedFolderId}
            busyAction={busyAction}
            onSelectFolder={(folder) => setSelectedFolderId(folder.id)}
            onToggleSelect={(id) =>
              setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
            }
            onSelectAll={() =>
              setSelectedIds((current) => (current.length === documents.length ? [] : documents.map((document) => document.id)))
            }
            onOpenDocument={setActiveDocument}
            onPreviewDocument={setPreviewDocument}
            onOpenPermissions={(document) => setPermissionModalItem({ type: 'document', item: document })}
            onOpenFolderPermissions={(folder) => setPermissionModalItem({ type: 'folder', item: folder })}
            onPushRag={setActiveRagDocument}
            onRequestAudit={(document) => void handleRequestAudit(document)}
            onPublish={(document) => void handlePublish(document)}
            onReject={(document) => {
              setRejectDocument(document);
              setRejectReason(document.rejectedReason ?? '');
            }}
            onCreateRevision={(document) => void handleCreateRevision(document)}
            onToggleLock={(document) => void handleToggleLock(document)}
            onDeleteDocument={setDeleteDocumentTarget}
            onDeleteFolder={(folder) => void handleDeleteFolderRequest(folder)}
            onOpenFolder={handleOpenFolder}
          />
        ) : (
          <DocumentGrid
            folders={visibleFolders}
            allFolders={folders}
            documents={documents}
            currentUser={currentUser}
            selectedFolderId={selectedFolderId}
            busyAction={busyAction}
            onSelectFolder={(folder) => setSelectedFolderId(folder.id)}
            onOpenDocument={setActiveDocument}
            onPreviewDocument={setPreviewDocument}
            onOpenPermissions={(document) => setPermissionModalItem({ type: 'document', item: document })}
            onOpenFolderPermissions={(folder) => setPermissionModalItem({ type: 'folder', item: folder })}
            onPushRag={setActiveRagDocument}
            onRequestAudit={(document) => void handleRequestAudit(document)}
            onPublish={(document) => void handlePublish(document)}
            onReject={(document) => {
              setRejectDocument(document);
              setRejectReason(document.rejectedReason ?? '');
            }}
            onCreateRevision={(document) => void handleCreateRevision(document)}
            onToggleLock={(document) => void handleToggleLock(document)}
            onDeleteDocument={setDeleteDocumentTarget}
            onDeleteFolder={(folder) => void handleDeleteFolderRequest(folder)}
            onOpenFolder={handleOpenFolder}
          />
        )}
      </div>

      <BatchActionBar count={selectedIds.length} onDelete={() => setIsDeleteConfirmOpen(true)} onClear={() => setSelectedIds([])} />

      {activeDocument ? (
        <ParsingModal
          document={activeDocument}
          folders={folders}
          onClose={() => setActiveDocument(null)}
          onUpdate={updateDocument}
        />
      ) : null}

      {previewDocument ? <DocumentViewerModal document={previewDocument} onClose={() => setPreviewDocument(null)} /> : null}

      {activeRagDocument ? (
        <RagModal document={activeRagDocument} onClose={() => setActiveRagDocument(null)} onUpdate={updateDocument} />
      ) : null}

      {isUploadModalOpen ? (
        <UploadModal
          parentFolder={currentFolder}
          onClose={() => setIsUploadModalOpen(false)}
          onUploaded={() => {
            void loadLibraryData(searchQuery, currentFolderId);
          }}
        />
      ) : null}

      {isNewFolderModalOpen ? (
        <NewFolderModal
          parentFolder={currentFolder}
          onClose={() => setIsNewFolderModalOpen(false)}
          onCreated={() => {
            void loadLibraryData(searchQuery, currentFolderId);
          }}
        />
      ) : null}

      {permissionModalItem ? (
        <PermissionModal
          isOpen={Boolean(permissionModalItem)}
          onClose={() => setPermissionModalItem(null)}
          type={permissionModalItem.type}
          itemId={permissionModalItem.item.id}
          itemName={permissionModalItem.item.name}
          initialAccessControl={permissionModalItem.item.accessControl}
          onSave={(accessControl) => {
            if (permissionModalItem.type === 'document') {
              setDocuments((current) =>
                current.map((document) =>
                  document.id === permissionModalItem.item.id ? { ...document, accessControl } : document
                )
              );
            } else {
              setFolders((current) =>
                current.map((folder) => (folder.id === permissionModalItem.item.id ? { ...folder, accessControl } : folder))
              );
            }
          }}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(rejectDocument)}
        title="驳回审核"
        description="请填写驳回原因，系统会将原因同步给提交人。"
        confirmLabel="确认驳回"
        tone="danger"
        busy={busyAction === (rejectDocument ? `reject:${rejectDocument.id}` : null)}
        confirmDisabled={!rejectReason.trim()}
        onClose={() => {
          setRejectDocument(null);
          setRejectReason('');
        }}
        onConfirm={() => void handleRejectConfirm()}
      >
        <textarea
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="例如：请补充回滚方案和发布验收步骤。"
          className="h-32 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-rose-100"
        />
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title="批量删除文档"
        description={`将删除 ${selectedIds.length} 个选中的文档，此操作不可撤销。`}
        confirmLabel="确认删除"
        tone="danger"
        busy={busyAction === 'batch-delete'}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => void handleBatchDelete()}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteDocumentTarget)}
        title="删除文档"
        description={deleteDocumentTarget ? `将删除“${deleteDocumentTarget.name}”，此操作不可恢复。` : ''}
        confirmLabel="确认删除"
        tone="danger"
        busy={busyAction === (deleteDocumentTarget ? `delete:${deleteDocumentTarget.id}` : null)}
        onClose={() => setDeleteDocumentTarget(null)}
        onConfirm={() => void handleDeleteDocumentConfirm()}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteFolderTarget)}
        title="删除文件夹"
        description={deleteFolderTarget ? `将删除空文件夹“${deleteFolderTarget.name}”，删除后不可恢复。` : ''}
        confirmLabel="确认删除"
        tone="danger"
        busy={busyAction === (deleteFolderTarget ? `delete-folder:${deleteFolderTarget.id}` : null)}
        onClose={() => setDeleteFolderTarget(null)}
        onConfirm={() => void handleDeleteFolderConfirm()}
      />

      <ConfirmDialog
        isOpen={Boolean(blockedFolderDeletion)}
        title="无法删除文件夹"
        description={
          blockedFolderDeletion
            ? `“${blockedFolderDeletion.folder.name}” 下仍有 ${blockedFolderDeletion.childFolderCount} 个子目录和 ${blockedFolderDeletion.documentCount} 个文档，请先清空目录内容。`
            : ''
        }
        confirmLabel="我知道了"
        tone="danger"
        onClose={() => setBlockedFolderDeletion(null)}
        onConfirm={() => setBlockedFolderDeletion(null)}
      />
    </div>
  );
}
