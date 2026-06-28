/**
 * 前端权限规则工具，集中处理目录继承、角色权限和状态限制判断。
 */
import { DEFAULT_ROLE_PERMISSIONS } from '../constants';
import { Document, Folder, PermissionAction, User } from '../types';
import { getFileExtension } from './documentFormats';

function uniquePermissions(actions: PermissionAction[]) {
  return Array.from(new Set(actions));
}

function isDocument(item: Document | Folder): item is Document {
  return 'latestSourceFile' in item;
}

function findFolderById(folders: Folder[], id?: string) {
  if (!id) {
    return undefined;
  }

  return folders.find((folder) => folder.id === id);
}

function getFolderPermissions(folder: Folder | undefined, user: User, folders: Folder[]): PermissionAction[] {
  if (!folder) {
    return [];
  }

  const direct = folder.accessControl.find((entry) => entry.userId === user.id)?.permissions ?? [];
  const inherited = getFolderPermissions(findFolderById(folders, folder.parentId), user, folders);
  const basePermissions = user.permissions ?? DEFAULT_ROLE_PERMISSIONS[user.role];

  return uniquePermissions([
    ...(user.departmentId === folder.departmentId ? basePermissions : []),
    ...inherited,
    ...direct,
  ]);
}

export function getEffectivePermissions(item: Document | Folder, user: User, folders: Folder[]) {
  const direct = item.accessControl.find((entry) => entry.userId === user.id)?.permissions ?? [];
  let inherited: PermissionAction[];
  const basePermissions = user.permissions ?? DEFAULT_ROLE_PERMISSIONS[user.role];

  if (isDocument(item)) {
    inherited = getFolderPermissions(findFolderById(folders, item.folderId), user, folders);
  } else {
    inherited = getFolderPermissions(findFolderById(folders, item.parentId), user, folders);
  }

  return uniquePermissions([
    ...(user.departmentId === item.departmentId ? basePermissions : []),
    ...inherited,
    ...direct,
  ]);
}

export function canAccessItem(item: Document | Folder, user: User, folders: Folder[]) {
  return getEffectivePermissions(item, user, folders).includes('view');
}

export function canManageFolder(folder: Folder, user: User, folders: Folder[]) {
  return getEffectivePermissions(folder, user, folders).includes('manage');
}

export function canPerformDocumentAction(
  document: Document,
  user: User,
  folders: Folder[],
  action: PermissionAction
) {
  const permissions = getEffectivePermissions(document, user, folders);
  const extension = getFileExtension(document.latestSourceFile);

  if (!permissions.includes(action)) {
    return false;
  }

  if (action === 'view') {
    return true;
  }

  if (document.status === 'locked') {
    return user.role === 'admin' && (action === 'lock' || action === 'delete');
  }

  if (document.status === 'parsing') {
    return false;
  }

    switch (action) {
      case 'correct':
        return document.status === 'uploaded' || document.status === 'rag_ready' || document.status === 'rejected';
    case 'push_rag':
      return (
        document.parseJob.status === 'success' &&
        document.status !== 'pending_audit' &&
        document.status !== 'published'
      );
    case 'request_audit':
      return document.status === 'rag_ready' || document.status === 'rejected';
    case 'publish':
    case 'reject':
      return user.role === 'admin' && document.status === 'pending_audit';
    case 'create_revision':
      return user.role === 'admin' && document.status === 'published';
    case 'edit':
      return document.status === 'uploaded' || document.status === 'rag_ready' || document.status === 'rejected';
    case 'delete':
      if (document.status === 'pending_audit') {
        return false;
      }
      if (document.status === 'published') {
        return user.role === 'admin';
      }
      return true;
    case 'lock':
      return user.role === 'admin' && document.status !== 'pending_audit';
    default:
      return true;
  }
}

export function isDocumentReadOnly(document: Document, user: User, folders: Folder[]) {
  return !canPerformDocumentAction(document, user, folders, 'correct');
}
