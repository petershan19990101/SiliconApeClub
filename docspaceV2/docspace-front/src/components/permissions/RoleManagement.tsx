import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Save, Shield, Trash2 } from 'lucide-react';
import { AdminRole, SystemMenuNode } from '../../types';
import { adminService } from '../../services/admin';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../lib/errors';
import { hasSystemPermission } from '../../lib/systemPermissions';
import { useUser } from '../../contexts/UserContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FormDialog } from '../ui/FormDialog';
import { PaginationBar } from '../ui/PaginationBar';

type RoleFormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  adminRole: boolean;
};

const EMPTY_FORM: RoleFormState = {
  code: '',
  name: '',
  description: '',
  enabled: true,
  adminRole: false,
};

const PAGE_SIZE = 8;

export function RoleManagement() {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [menuTree, setMenuTree] = useState<SystemMenuNode[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null);
  const [permissionRole, setPermissionRole] = useState<AdminRole | null>(null);
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const canCreate = hasSystemPermission(currentUser, 'permission.role.create');
  const canEdit = hasSystemPermission(currentUser, 'permission.role.edit');
  const canDelete = hasSystemPermission(currentUser, 'permission.role.delete');
  const canAssign = hasSystemPermission(currentUser, 'permission.role.assign');

  const pagedRoles = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return roles.slice(start, start + PAGE_SIZE);
  }, [page, roles]);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(roles.length / PAGE_SIZE));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, roles.length]);

  async function loadInitialData() {
    try {
      const [nextRoles, nextMenuTree] = await Promise.all([
        adminService.listRoles(),
        adminService.listMenuTree(),
      ]);
      setRoles(nextRoles);
      setMenuTree(nextMenuTree);
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '角色数据加载失败',
        description: getErrorMessage(error, '角色数据加载失败'),
      });
    }
  }

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openEditModal = (role: AdminRole) => {
    setForm({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? '',
      enabled: role.enabled,
      adminRole: role.adminRole,
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

  const openPermissionModal = async (role: AdminRole) => {
    setBusy(true);
    try {
      const ids = await adminService.getRolePermissionIds(role.id);
      setPermissionRole(role);
      setPermissionIds(ids.map(String));
      setPermissionOpen(true);
    } catch (error) {
      pushToast({ tone: 'error', title: '权限加载失败', description: getErrorMessage(error, '角色权限加载失败') });
    } finally {
      setBusy(false);
    }
  };

  const closePermissionModal = () => {
    if (busy) {
      return;
    }
    setPermissionOpen(false);
    setPermissionRole(null);
    setPermissionIds([]);
  };

  const handleSaveRole = async () => {
    if (!form.id && !canCreate) {
      return;
    }
    if (form.id && !canEdit) {
      return;
    }
    setBusy(true);
    try {
      const savedRole = form.id
        ? await adminService.updateRole(form.id, form)
        : await adminService.createRole(form);
      pushToast({
        tone: 'success',
        title: form.id ? '角色已更新' : '角色已创建',
        description: `${savedRole.name} 已保存。`,
      });
      await loadInitialData();
      closeEditor();
    } catch (error) {
      pushToast({ tone: 'error', title: '保存失败', description: getErrorMessage(error, '角色保存失败') });
    } finally {
      setBusy(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!permissionRole) {
      return;
    }
    setBusy(true);
    try {
      await adminService.updateRolePermissionIds(permissionRole.id, permissionIds);
      pushToast({ tone: 'success', title: '授权已更新', description: `${permissionRole.name} 的权限配置已保存。` });
      closePermissionModal();
    } catch (error) {
      pushToast({ tone: 'error', title: '授权失败', description: getErrorMessage(error, '角色授权失败') });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget) {
      return;
    }
    setBusy(true);
    try {
      await adminService.deleteRole(deleteTarget.id);
      pushToast({ tone: 'success', title: '角色已删除', description: `${deleteTarget.name} 已删除。` });
      setDeleteTarget(null);
      await loadInitialData();
    } catch (error) {
      pushToast({ tone: 'error', title: '删除失败', description: getErrorMessage(error, '角色删除失败') });
    } finally {
      setBusy(false);
    }
  };

  const togglePermission = (menuId: string) => {
    setPermissionIds((current) => (current.includes(menuId) ? current.filter((item) => item !== menuId) : [...current, menuId]));
  };

  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">角色列表</h3>
            <p className="mt-1 text-sm text-slate-500">主界面专注展示记录列表，基础信息编辑和授权都通过弹窗完成。</p>
          </div>
          {canCreate ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"
            >
              <Plus size={16} />
              新增角色
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto px-5 py-5">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-wider text-slate-400">
                <th className="pb-3 pr-4">角色名称</th>
                <th className="pb-3 pr-4">编码</th>
                <th className="pb-3 pr-4">描述</th>
                <th className="pb-3 pr-4">成员数</th>
                <th className="pb-3 pr-4">管理员角色</th>
                <th className="pb-3 pr-4">状态</th>
                <th className="pb-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedRoles.length ? (
                pagedRoles.map((role) => (
                  <tr key={role.id} className="align-top text-slate-700">
                    <td className="py-4 pr-4 font-bold text-slate-900">{role.name}</td>
                    <td className="py-4 pr-4">{role.code}</td>
                    <td className="py-4 pr-4">{role.description || '--'}</td>
                    <td className="py-4 pr-4">{role.memberCount}</td>
                    <td className="py-4 pr-4">
                      {role.adminRole ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">管理员</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">普通</span>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${role.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {role.enabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(role)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600"
                          >
                            <Pencil size={14} />
                            编辑
                          </button>
                        ) : null}
                        {canAssign ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void openPermissionModal(role)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                          >
                            <Shield size={14} />
                            授权
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDeleteTarget(role)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            删除
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                    暂无角色记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar page={page} pageSize={PAGE_SIZE} total={roles.length} onPageChange={setPage} />
      </section>

      <FormDialog
        isOpen={editorOpen}
        onClose={closeEditor}
        title={form.id ? '编辑角色' : '新增角色'}
        description="基础角色信息通过弹窗编辑，取消即可放弃本次修改。"
        widthClassName="max-w-3xl"
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
                onClick={() => void handleSaveRole()}
                disabled={busy || (!form.id && !canCreate) || (!!form.id && !canEdit)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                <Save size={16} />
                {busy ? '保存中...' : '保存角色'}
              </button>
            ) : null}
          </>
        )}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="角色编码">
            <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="角色名称">
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="角色描述">
            <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="启用状态">
            <select value={String(form.enabled)} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.value === 'true' }))} className={inputClass}>
              <option value="true">启用</option>
              <option value="false">停用</option>
            </select>
          </Field>
          <Field label="管理员角色">
            <select value={String(form.adminRole)} onChange={(event) => setForm((current) => ({ ...current, adminRole: event.target.value === 'true' }))} className={inputClass}>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </Field>
        </div>
      </FormDialog>

      <FormDialog
        isOpen={permissionOpen}
        onClose={closePermissionModal}
        title={permissionRole ? `${permissionRole.name} 权限授权` : '角色授权'}
        description="勾选后表示该角色拥有对应页面或按钮权限，保存前可随时取消。"
        widthClassName="max-w-5xl"
        footer={(
          <>
            <button
              type="button"
              onClick={closePermissionModal}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
            >
              取消
            </button>
            {canAssign ? (
              <button
                type="button"
                onClick={() => void handleSavePermissions()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                <Shield size={16} />
                {busy ? '保存中...' : '保存授权'}
              </button>
            ) : null}
          </>
        )}
      >
        <div className="rounded-3xl border border-slate-100 p-4">
          <PermissionTree menus={menuTree} checkedIds={permissionIds} onToggle={togglePermission} />
        </div>
      </FormDialog>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="删除角色"
        description={deleteTarget ? `确认删除角色“${deleteTarget.name}”吗？` : ''}
        confirmLabel="确认删除"
        tone="danger"
        busy={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteRole()}
      />
    </>
  );
}

function PermissionTree({
  menus,
  checkedIds,
  onToggle,
}: {
  menus: SystemMenuNode[];
  checkedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {menus.map((menu) => (
        <div key={menu.id}>
          <label className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50">
            <input type="checkbox" checked={checkedIds.includes(menu.id)} onChange={() => onToggle(menu.id)} className="h-4 w-4 rounded border-slate-300 text-blue-700" />
            <span className="text-sm font-medium text-slate-700">
              {menu.name}
              <span className="ml-2 text-[10px] uppercase text-slate-400">{menu.type}</span>
            </span>
          </label>
          {menu.children.length ? (
            <div className="ml-6 border-l border-slate-100 pl-3">
              <PermissionTree menus={menu.children} checkedIds={checkedIds} onToggle={onToggle} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
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
