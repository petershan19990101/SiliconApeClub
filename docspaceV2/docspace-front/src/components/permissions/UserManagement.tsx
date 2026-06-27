import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, Save, UserRoundCheck, UserRoundX } from 'lucide-react';
import { AdminRole, AdminUser, Department } from '../../types';
import { adminService } from '../../services/admin';
import { documentRepository } from '../../services';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../lib/errors';
import { hasSystemPermission } from '../../lib/systemPermissions';
import { useUser } from '../../contexts/UserContext';
import { FormDialog } from '../ui/FormDialog';
import { PaginationBar } from '../ui/PaginationBar';

type UserFormState = {
  id?: string;
  username: string;
  displayName: string;
  email: string;
  departmentId: string;
  enabled: boolean;
  password?: string;
  roleIds: string[];
};

const EMPTY_FORM: UserFormState = {
  username: '',
  displayName: '',
  email: '',
  departmentId: '',
  enabled: true,
  password: 'Member@123',
  roleIds: [],
};

const PAGE_SIZE = 8;

export function UserManagement() {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const canCreate = hasSystemPermission(currentUser, 'permission.user.create');
  const canEdit = hasSystemPermission(currentUser, 'permission.user.edit');
  const canEnable = hasSystemPermission(currentUser, 'permission.user.enable');
  const canDisable = hasSystemPermission(currentUser, 'permission.user.disable');
  const canAssignRole = hasSystemPermission(currentUser, 'permission.user.assign_role');
  const canResetPassword = hasSystemPermission(currentUser, 'permission.user.reset_password');

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return users.slice(start, start + PAGE_SIZE);
  }, [page, users]);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, users.length]);

  async function loadInitialData() {
    try {
      const [nextUsers, nextRoles, nextDepartments] = await Promise.all([
        adminService.listUsers(),
        adminService.listRoles(),
        documentRepository.getDepartments(),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
      setDepartments(nextDepartments);
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '用户数据加载失败',
        description: getErrorMessage(error, '用户数据加载失败'),
      });
    }
  }

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openEditModal = (user: AdminUser) => {
    setForm({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      departmentId: user.departmentId,
      enabled: user.enabled,
      roleIds: user.roles.map((role) => role.id),
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (busy) {
      return;
    }
    setEditorOpen(false);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.id && !canCreate) {
      return;
    }
    if (form.id && !canEdit) {
      return;
    }
    if (!form.departmentId) {
      pushToast({ tone: 'error', title: '请选择所属部门' });
      return;
    }
    if (canAssignRole && form.roleIds.length === 0) {
      pushToast({ tone: 'error', title: '请至少选择一个角色' });
      return;
    }

    setBusy(true);
    try {
      let savedUser: AdminUser;
      if (form.id) {
        savedUser = await adminService.updateUser(form.id, {
          username: form.username,
          displayName: form.displayName,
          email: form.email,
          departmentId: form.departmentId,
          enabled: form.enabled,
        });
      } else {
        savedUser = await adminService.createUser({
          username: form.username,
          displayName: form.displayName,
          email: form.email,
          departmentId: form.departmentId,
          enabled: form.enabled,
          password: form.password,
        });
      }

      if (canAssignRole && form.roleIds.length > 0) {
        await adminService.updateUserRoles(savedUser.id, form.roleIds);
      }

      pushToast({
        tone: 'success',
        title: form.id ? '用户已更新' : '用户已创建',
        description: `${savedUser.displayName} 的资料已保存。`,
      });
      await loadInitialData();
      closeEditor();
    } catch (error) {
      pushToast({ tone: 'error', title: '保存失败', description: getErrorMessage(error, '用户保存失败') });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStatus = async (user: AdminUser, enabled: boolean) => {
    setBusy(true);
    try {
      if (enabled) {
        await adminService.enableUser(user.id);
      } else {
        await adminService.disableUser(user.id);
      }
      pushToast({
        tone: 'success',
        title: enabled ? '用户已启用' : '用户已停用',
        description: `${user.displayName} 状态已更新。`,
      });
      await loadInitialData();
    } catch (error) {
      pushToast({ tone: 'error', title: '状态更新失败', description: getErrorMessage(error, '状态更新失败') });
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    setBusy(true);
    try {
      await adminService.resetPassword(user.id, 'Member@123');
      pushToast({
        tone: 'success',
        title: '密码已重置',
        description: `${user.displayName} 已重置为默认密码 Member@123。`,
      });
    } catch (error) {
      pushToast({ tone: 'error', title: '密码重置失败', description: getErrorMessage(error, '密码重置失败') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">用户列表</h3>
            <p className="mt-1 text-sm text-slate-500">主界面专注展示记录列表，新增和编辑统一通过弹窗处理。</p>
          </div>
          {canCreate ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"
            >
              <Plus size={16} />
              新增用户
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto px-5 py-5">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-wider text-slate-400">
                <th className="pb-3 pr-4">姓名</th>
                <th className="pb-3 pr-4">用户名</th>
                <th className="pb-3 pr-4">邮箱</th>
                <th className="pb-3 pr-4">部门</th>
                <th className="pb-3 pr-4">角色</th>
                <th className="pb-3 pr-4">状态</th>
                <th className="pb-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedUsers.length ? (
                pagedUsers.map((user) => (
                  <tr key={user.id} className="align-top text-slate-700">
                    <td className="py-4 pr-4 font-bold text-slate-900">{user.displayName}</td>
                    <td className="py-4 pr-4">{user.username}</td>
                    <td className="py-4 pr-4">{user.email}</td>
                    <td className="py-4 pr-4">{user.departmentName ?? '--'}</td>
                    <td className="py-4 pr-4">{user.roles.map((role) => role.name).join(' / ') || '--'}</td>
                    <td className="py-4 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {user.enabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600"
                          >
                            <Pencil size={14} />
                            编辑
                          </button>
                        ) : null}
                        {canEnable && !user.enabled ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleStatus(user, true)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 disabled:opacity-50"
                          >
                            <UserRoundCheck size={14} />
                            启用
                          </button>
                        ) : null}
                        {canDisable && user.enabled ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleStatus(user, false)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 disabled:opacity-50"
                          >
                            <UserRoundX size={14} />
                            停用
                          </button>
                        ) : null}
                        {canResetPassword ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleResetPassword(user)}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 disabled:opacity-50"
                          >
                            <KeyRound size={14} />
                            重置密码
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                    暂无用户记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar page={page} pageSize={PAGE_SIZE} total={users.length} onPageChange={setPage} />
      </section>

      <FormDialog
        isOpen={editorOpen}
        onClose={closeEditor}
        title={form.id ? '编辑用户' : '新增用户'}
        description="用户信息和角色绑定通过弹窗完成编辑，取消即可放弃本次修改。"
        widthClassName="max-w-5xl"
        footer={(
          <>
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
            >
              取消
            </button>
            {(canCreate || canEdit) ? (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy || (!form.id && !canCreate) || (!!form.id && !canEdit)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                <Save size={16} />
                {busy ? '保存中...' : '保存用户'}
              </button>
            ) : null}
          </>
        )}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="用户名">
            <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="姓名">
            <input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="邮箱">
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="部门">
            <select value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))} className={inputClass}>
              <option value="">请选择</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>
          {!form.id ? (
            <Field label="初始密码">
              <input value={form.password ?? ''} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className={inputClass} />
            </Field>
          ) : null}
          <Field label="启用状态">
            <select value={String(form.enabled)} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.value === 'true' }))} className={inputClass}>
              <option value="true">启用</option>
              <option value="false">停用</option>
            </select>
          </Field>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">角色绑定</p>
          <div className="grid gap-3 md:grid-cols-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.roleIds.includes(role.id)}
                  disabled={!canAssignRole}
                  onChange={() =>
                    setForm((current) => ({
                      ...current,
                      roleIds: current.roleIds.includes(role.id)
                        ? current.roleIds.filter((item) => item !== role.id)
                        : [...current.roleIds, role.id],
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                <div>
                  <p className="text-sm font-bold text-slate-900">{role.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{role.code}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </FormDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-100';
