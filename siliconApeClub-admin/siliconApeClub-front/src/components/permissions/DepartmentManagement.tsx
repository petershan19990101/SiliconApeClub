import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import { AdminDepartment, DepartmentDeleteCheck } from '../../types';
import { adminService } from '../../services/admin';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../lib/errors';
import { hasSystemPermission } from '../../lib/systemPermissions';
import { useUser } from '../../contexts/UserContext';

type DepartmentFormState = {
  id?: string;
  parentId?: string;
  name: string;
};

const EMPTY_FORM: DepartmentFormState = {
  name: '',
};

export function DepartmentManagement() {
  const { currentUser, refreshCurrentUser } = useUser();
  const { pushToast } = useToast();
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [expandedDepartmentIds, setExpandedDepartmentIds] = useState<string[]>([]);
  const [createOriginId, setCreateOriginId] = useState<string | null>(null);
  const [form, setForm] = useState<DepartmentFormState>(EMPTY_FORM);
  const [deleteCheck, setDeleteCheck] = useState<DepartmentDeleteCheck | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = hasSystemPermission(currentUser, 'permission.department.create');
  const canEdit = hasSystemPermission(currentUser, 'permission.department.edit');
  const canDelete = hasSystemPermission(currentUser, 'permission.department.delete');

  const flatDepartments = useMemo(() => flattenDepartments(departments), [departments]);
  const expandedDepartmentIdSet = useMemo(() => new Set(expandedDepartmentIds), [expandedDepartmentIds]);
  const selectedDepartment = useMemo(
    () => (selectedDepartmentId ? flatDepartments.find((department) => department.id === selectedDepartmentId) : undefined),
    [flatDepartments, selectedDepartmentId]
  );
  const disallowedParentIds = useMemo(
    () => new Set(selectedDepartment ? [selectedDepartment.id, ...collectDescendantIds(selectedDepartment)] : []),
    [selectedDepartment]
  );
  const isCreating = !form.id;

  useEffect(() => {
    void loadDepartments();
  }, []);

  useEffect(() => {
    if (!selectedDepartment) {
      return;
    }
    setForm({
      id: selectedDepartment.id,
      parentId: selectedDepartment.parentId,
      name: selectedDepartment.name,
    });
    setDeleteCheck(null);
    setCreateOriginId(null);
  }, [selectedDepartment]);

  const expandAncestorDepartments = (tree: AdminDepartment[], targetId: string) => {
    const ancestorIds = findDepartmentAncestorIds(tree, targetId) ?? [];
    if (!ancestorIds.length) {
      return;
    }
    setExpandedDepartmentIds((current) => Array.from(new Set([...current, ...ancestorIds])));
  };

  async function loadDepartments(preferredSelectedId?: string | null) {
    try {
      const data = await adminService.listDepartmentTree();
      setDepartments(data);
      const nextSelectedId = resolvePreferredDepartmentId(data, preferredSelectedId === undefined ? selectedDepartmentId : preferredSelectedId);
      setSelectedDepartmentId(nextSelectedId);
      if (nextSelectedId) {
        expandAncestorDepartments(data, nextSelectedId);
      } else {
        setForm(EMPTY_FORM);
      }
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '部门加载失败',
        description: getErrorMessage(error, '部门加载失败'),
      });
    }
  }

  const handleSelectDepartment = (id: string) => {
    setSelectedDepartmentId(id);
    setCreateOriginId(null);
    setDeleteCheck(null);
    expandAncestorDepartments(departments, id);
  };

  const handleToggleExpanded = (id: string) => {
    setExpandedDepartmentIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const resetToCreate = (parentId?: string) => {
    setCreateOriginId(selectedDepartmentId);
    setSelectedDepartmentId(null);
    setDeleteCheck(null);
    setForm({
      ...EMPTY_FORM,
      parentId,
    });
  };

  const handleCancelCreate = () => {
    const fallbackId = resolvePreferredDepartmentId(departments, createOriginId ?? selectedDepartmentId);
    setCreateOriginId(null);
    setDeleteCheck(null);
    setSelectedDepartmentId(fallbackId);
    if (fallbackId) {
      expandAncestorDepartments(departments, fallbackId);
    } else {
      setForm(EMPTY_FORM);
    }
  };

  const handleSave = async () => {
    const actionAllowed = form.id ? canEdit : canCreate;
    if (!actionAllowed) {
      return;
    }
    setBusy(true);
    try {
      if (form.id) {
        const updated = await adminService.updateDepartment(form.id, form);
        pushToast({ tone: 'success', title: '部门已更新', description: `${updated.name} 已保存。` });
        await loadDepartments(updated.id);
      } else {
        const created = await adminService.createDepartment(form);
        pushToast({ tone: 'success', title: '部门已创建', description: `${created.name} 已加入组织树。` });
        setCreateOriginId(null);
        await loadDepartments(created.id);
      }
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '保存失败',
        description: getErrorMessage(error, '部门保存失败'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteIntent = async () => {
    if (!form.id || !canDelete) {
      return;
    }
    setBusy(true);
    try {
      setDeleteCheck(await adminService.getDepartmentDeleteCheck(form.id));
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '删除检查失败',
        description: getErrorMessage(error, '删除检查失败'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!form.id || !deleteCheck) {
      return;
    }
    const blockedTopLevel = deleteCheck.topLevel && !isEmptyTopLevel(deleteCheck);
    if (blockedTopLevel) {
      return;
    }
    setBusy(true);
    try {
      await adminService.deleteDepartment(form.id);
      pushToast({
        tone: 'success',
        title: '部门已删除',
        description: deleteCheck.topLevel
          ? `${deleteCheck.departmentName} 已删除。`
          : `${deleteCheck.departmentName} 已删除并转移归属关系。`,
      });
      await loadDepartments();
      await refreshCurrentUser();
      setDeleteCheck(null);
      setCreateOriginId(null);
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '删除失败',
        description: getErrorMessage(error, '部门删除失败'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-900">部门树</h3>
          <p className="mt-1 text-xs text-slate-400">默认折叠展示组织层级，按需展开查看上下级关系。</p>
        </div>

        <div className="custom-scrollbar max-h-[62vh] overflow-auto pr-2">
          <DepartmentTree
            departments={departments}
            selectedId={selectedDepartmentId}
            expandedIds={expandedDepartmentIdSet}
            onSelect={handleSelectDepartment}
            onToggleExpanded={handleToggleExpanded}
            onCreateChild={canCreate ? (parentId) => resetToCreate(parentId) : undefined}
          />
        </div>

        {canCreate ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => resetToCreate()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700"
            >
              <Plus size={16} />
              新增一级部门
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{form.id ? '编辑部门' : '创建部门'}</h3>
            <p className="mt-1 text-sm text-slate-500">v1 仅维护部门名称和上级关系，删除时按规则处理归属迁移。</p>
          </div>
          {form.id && canDelete ? (
            <button
              type="button"
              onClick={() => void handleDeleteIntent()}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600"
            >
              <Trash2 size={16} />
              删除
            </button>
          ) : null}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="部门名称">
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="上级部门">
            <select
              value={form.parentId ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value || undefined }))}
              className={inputClass}
            >
              <option value="">设为顶层部门</option>
              {flatDepartments
                .filter((department) => !disallowedParentIds.has(department.id))
                .map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>

        {deleteCheck ? (
          <DeleteSummary
            deleteCheck={deleteCheck}
            busy={busy}
            onCancel={() => setDeleteCheck(null)}
            onConfirm={() => void handleDeleteConfirm()}
          />
        ) : null}

        <div className="mt-8 flex justify-end gap-3">
          {canCreate && form.id ? (
            <button type="button" onClick={() => resetToCreate(form.parentId)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">
              新建同级
            </button>
          ) : null}
          {canCreate && form.id ? (
            <button type="button" onClick={() => resetToCreate(form.id)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">
              新建子级
            </button>
          ) : null}
          {canCreate && isCreating ? (
            <button type="button" onClick={handleCancelCreate} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">
              取消
            </button>
          ) : null}
          {(canCreate || canEdit) ? (
            <button
              type="button"
              disabled={busy || (!form.id && !canCreate) || (!!form.id && !canEdit)}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Save size={16} />
              {busy ? '保存中...' : '保存部门'}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DepartmentTree({
  departments,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpanded,
  onCreateChild,
}: {
  departments: AdminDepartment[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onCreateChild?: (parentId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {departments.map((department) => {
        const hasChildren = department.children.length > 0;
        const expanded = expandedIds.has(department.id);

        return (
          <div key={department.id}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggleExpanded(department.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <span className="block h-8 w-8 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelect(department.id)}
                className={`flex min-w-0 flex-1 items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  selectedId === department.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{department.name}</span>
              </button>
              {onCreateChild ? (
                <button
                  type="button"
                  onClick={() => onCreateChild(department.id)}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200"
                >
                  子级
                </button>
              ) : null}
            </div>
            {hasChildren && expanded ? (
              <div className="ml-4 mt-2 border-l border-slate-100 pl-3">
                <DepartmentTree
                  departments={department.children}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  onSelect={onSelect}
                  onToggleExpanded={onToggleExpanded}
                  onCreateChild={onCreateChild}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DeleteSummary({
  deleteCheck,
  busy,
  onCancel,
  onConfirm,
}: {
  deleteCheck: DepartmentDeleteCheck;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const blockedTopLevel = deleteCheck.topLevel && !isEmptyTopLevel(deleteCheck);

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h4 className="text-sm font-bold text-slate-900">删除确认</h4>
      <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
        <div>部门：{deleteCheck.departmentName}</div>
        <div>上级：{deleteCheck.parentName ?? '无（顶层部门）'}</div>
        <div>直接子部门：{deleteCheck.childDepartmentCount}</div>
        <div>用户：{deleteCheck.userCount}</div>
        <div>目录：{deleteCheck.folderCount}</div>
        <div>文档：{deleteCheck.documentCount}</div>
      </div>
      <p className={`mt-4 text-sm ${blockedTopLevel ? 'text-rose-600' : 'text-slate-500'}`}>
        {blockedTopLevel
          ? '当前是非空顶层部门，需要先清空子部门、用户、目录和文档后才能删除。'
          : deleteCheck.topLevel
            ? '当前顶层部门为空，确认后将直接删除。'
            : '确认后会将直接子部门、用户、目录和文档统一转移到上级部门，ACL 保持不变。'}
      </p>
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-600">
          取消
        </button>
        <button
          type="button"
          disabled={busy || blockedTopLevel}
          onClick={onConfirm}
          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? '处理中...' : '确认删除'}
        </button>
      </div>
    </div>
  );
}

function flattenDepartments(departments: AdminDepartment[]): AdminDepartment[] {
  const result: AdminDepartment[] = [];
  const walk = (nodes: AdminDepartment[]) => {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children.length) {
        walk(node.children);
      }
    });
  };
  walk(departments);
  return result;
}

function collectDescendantIds(department: AdminDepartment): string[] {
  const result: string[] = [];
  const walk = (nodes: AdminDepartment[]) => {
    nodes.forEach((node) => {
      result.push(node.id);
      if (node.children.length) {
        walk(node.children);
      }
    });
  };
  walk(department.children);
  return result;
}

function resolvePreferredDepartmentId(departments: AdminDepartment[], preferredId?: string | null) {
  const flat = flattenDepartments(departments);
  if (preferredId && flat.some((item) => item.id === preferredId)) {
    return preferredId;
  }
  return departments[0]?.id ?? null;
}

function findDepartmentAncestorIds(departments: AdminDepartment[], targetId: string, path: string[] = []): string[] | null {
  for (const department of departments) {
    if (department.id === targetId) {
      return path;
    }
    if (department.children.length) {
      const nested = findDepartmentAncestorIds(department.children, targetId, [...path, department.id]);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function isEmptyTopLevel(deleteCheck: DepartmentDeleteCheck) {
  return deleteCheck.childDepartmentCount === 0
    && deleteCheck.userCount === 0
    && deleteCheck.folderCount === 0
    && deleteCheck.documentCount === 0;
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
