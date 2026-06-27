/**
 * 权限管理弹窗，用于维护文档或目录的成员访问控制配置。
 */
import React, { useEffect, useState } from 'react';
import { Search, Trash2, UserPlus, Users as UsersIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ACTION_LABELS } from '../constants';
import { AccessControlEntry, PermissionAction, User } from '../types';
import { documentRepository } from '../services';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../lib/errors';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'document' | 'folder';
  itemId: string;
  itemName: string;
  initialAccessControl: AccessControlEntry[];
  onSave: (accessControl: AccessControlEntry[]) => void;
}

const ACTIONS: PermissionAction[] = [
  'view',
  'edit',
  'upload',
  'delete',
  'manage',
  'correct',
  'push_rag',
  'request_audit',
  'publish',
  'reject',
  'create_revision',
  'lock',
];

const FOLDER_ACTIONS: PermissionAction[] = ['view', 'edit', 'upload', 'delete', 'manage'];

export function PermissionModal({
  isOpen,
  onClose,
  type,
  itemId,
  itemName,
  initialAccessControl,
  onSave,
}: PermissionModalProps) {
  const { pushToast } = useToast();
  const [accessControl, setAccessControl] = useState<AccessControlEntry[]>(initialAccessControl);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const actionOptions = type === 'folder' ? FOLDER_ACTIONS : ACTIONS;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAccessControl(initialAccessControl);
    setSearchQuery('');
    setIsAddingUser(false);
    async function fetchUsers() {
      const users = await documentRepository.listUsers();
      setAvailableUsers(users);
    }

    void fetchUsers();
  }, [initialAccessControl, isOpen]);

  const handleTogglePermission = (userId: string, action: PermissionAction) => {
    setAccessControl((current) =>
      current.map((entry) => {
        if (entry.userId !== userId) {
          return entry;
        }

        const hasPermission = entry.permissions.includes(action);
        return {
          ...entry,
          permissions: hasPermission
            ? entry.permissions.filter((permission) => permission !== action)
            : [...entry.permissions, action],
        };
      })
    );
  };

  const handleAddUser = (user: User) => {
    if (accessControl.some((entry) => entry.userId === user.id)) {
      return;
    }

    setAccessControl((current) => [
      ...current,
      {
        userId: user.id,
        userName: user.name,
        role: user.role,
        permissions: ['view'],
      },
    ]);
    setIsAddingUser(false);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await documentRepository.updateAccessControl(type, itemId, accessControl);
      onSave(accessControl);
      pushToast({
        tone: 'success',
        title: '权限已更新',
        description: `“${itemName}” 的访问控制已保存。`,
      });
      onClose();
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '保存失败',
        description: getErrorMessage(caughtError, '权限保存失败'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.button
        type="button"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
              <UsersIcon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">成员权限管理</h2>
              <p className="text-sm text-slate-500">
                正在管理 {type === 'folder' ? '目录' : '文档'}：<span className="font-bold text-blue-700">{itemName}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索已添加成员..."
                className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setIsAddingUser((current) => !current)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
              >
                <UserPlus size={18} />
                添加成员
              </button>

              <AnimatePresence>
                {isAddingUser ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 z-20 mt-3 w-64 rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl"
                  >
                    {availableUsers
                      .filter((user) => !accessControl.some((entry) => entry.userId === user.id))
                      .map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleAddUser(user)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{user.name}</p>
                            <p className="text-[10px] text-slate-400">{user.email}</p>
                          </div>
                        </button>
                      ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-100">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">成员</th>
                  <th className="px-6 py-4">权限配置</th>
                  <th className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {accessControl
                  .filter((entry) => entry.userName.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((entry) => (
                    <tr key={entry.userId} className="hover:bg-slate-50/60">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                            {entry.userName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{entry.userName}</p>
                            <p className="text-[10px] text-slate-400">{entry.role === 'admin' ? '管理员' : '普通成员'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {actionOptions.map((action) => {
                            const active = entry.permissions.includes(action);
                            return (
                              <button
                                key={action}
                                onClick={() => handleTogglePermission(entry.userId, action)}
                                className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                                  active
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                                }`}
                              >
                                {ACTION_LABELS[action]}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setAccessControl((current) => current.filter((item) => item.userId !== entry.userId))}
                          className="rounded-xl p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-8 py-4">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-200">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl bg-blue-700 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '保存更改'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
