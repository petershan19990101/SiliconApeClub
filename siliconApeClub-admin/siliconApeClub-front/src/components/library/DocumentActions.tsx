import React from 'react';
import {
  CheckSquare,
  Eye,
  Lock,
  Send,
  Shield,
  Trash2,
  Unlock,
  Users,
  XCircle,
} from 'lucide-react';
import { Document, Folder, User } from '../../types';
import { canPerformDocumentAction } from '../../lib/permissions';
import { cx } from '../../lib/format';
import { hasSystemPermission } from '../../lib/systemPermissions';

interface DocumentActionsProps {
  document: Document;
  folders: Folder[];
  currentUser: User;
  busyAction?: string | null;
  onOpenDocument: (document: Document) => void;
  onOpenPermissions: (document: Document) => void;
  onOpenKnowledgePipeline: (document: Document) => void;
  onRequestAudit: (document: Document) => void;
  onPublish: (document: Document) => void;
  onReject: (document: Document) => void;
  onCreateRevision: (document: Document) => void;
  onToggleLock: (document: Document) => void;
  onDelete: (document: Document) => void;
}

export function DocumentActions({
  document,
  folders,
  currentUser,
  busyAction,
  onOpenDocument,
  onOpenPermissions,
  onOpenKnowledgePipeline,
  onRequestAudit,
  onPublish,
  onReject,
  onCreateRevision,
  onToggleLock,
  onDelete,
}: DocumentActionsProps) {
  const canCorrect = canPerformDocumentAction(document, currentUser, folders, 'correct');
  const canRunKnowledgePipeline =
    canPerformDocumentAction(document, currentUser, folders, 'push_rag') &&
    hasSystemPermission(currentUser, 'document.push_rag');
  const canRequestAudit =
    canPerformDocumentAction(document, currentUser, folders, 'request_audit') &&
    hasSystemPermission(currentUser, 'document.request_audit');
  const canPublish =
    canPerformDocumentAction(document, currentUser, folders, 'publish') &&
    hasSystemPermission(currentUser, 'document.publish');
  const canReject =
    canPerformDocumentAction(document, currentUser, folders, 'reject') &&
    hasSystemPermission(currentUser, 'document.reject');
  const canCreateRevision =
    canPerformDocumentAction(document, currentUser, folders, 'create_revision') &&
    hasSystemPermission(currentUser, 'document.create_revision');
  const canLock =
    currentUser.role === 'admin' &&
    (canPerformDocumentAction(document, currentUser, folders, 'lock') || document.status === 'locked') &&
    hasSystemPermission(currentUser, 'document.lock');
  const canDelete =
    canPerformDocumentAction(document, currentUser, folders, 'delete') &&
    hasSystemPermission(currentUser, 'document.delete');
  const canManagePermissions =
    currentUser.role === 'admin' && hasSystemPermission(currentUser, 'document.permission.manage');

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canManagePermissions ? (
        <ActionButton label="权限" icon={Users} onClick={() => onOpenPermissions(document)} />
      ) : null}

      <ActionButton
        label={canCorrect ? '校正' : '查看'}
        icon={Eye}
        onClick={() => onOpenDocument(document)}
        tone="primary"
      />

      {canRunKnowledgePipeline ? (
        <ActionButton
          label={document.ragJob.status === 'failed' ? '重试生成' : document.ragJob.status === 'success' ? '重建 Wiki' : '生成 Wiki'}
          icon={Send}
          tone="success"
          busy={busyAction === `pipeline:${document.id}`}
          onClick={() => onOpenKnowledgePipeline(document)}
        />
      ) : null}

      {canRequestAudit ? (
        <ActionButton
          label="提交审核"
          icon={CheckSquare}
          tone="warning"
          busy={busyAction === `submit:${document.id}`}
          onClick={() => onRequestAudit(document)}
        />
      ) : null}

      {canPublish ? (
        <ActionButton
          label="审核发布"
          icon={Shield}
          tone="success"
          busy={busyAction === `publish:${document.id}`}
          onClick={() => onPublish(document)}
        />
      ) : null}

      {canReject ? <ActionButton label="驳回" icon={XCircle} tone="danger" onClick={() => onReject(document)} /> : null}

      {canCreateRevision ? (
        <ActionButton
          label="创建修订"
          icon={Eye}
          tone="primary"
          busy={busyAction === `revision:${document.id}`}
          onClick={() => onCreateRevision(document)}
        />
      ) : null}

      {canDelete ? (
        <ActionButton
          label="删除"
          icon={Trash2}
          tone="danger"
          busy={busyAction === `delete:${document.id}`}
          onClick={() => onDelete(document)}
        />
      ) : null}

      {canLock ? (
        <button
          type="button"
          title={document.status === 'locked' ? '解除锁定' : '锁定版本'}
          onClick={() => onToggleLock(document)}
          className={cx(
            'rounded-lg p-2 transition',
            document.status === 'locked'
              ? 'bg-slate-900 text-white hover:brightness-110'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          )}
        >
          {document.status === 'locked' ? <Unlock size={16} /> : <Lock size={16} />}
        </button>
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  tone = 'default',
  busy = false,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  busy?: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    default: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    primary: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    success: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    warning: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  }[tone];

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60',
        toneClass
      )}
    >
      <Icon size={14} />
      {busy ? '处理中...' : label}
    </button>
  );
}
