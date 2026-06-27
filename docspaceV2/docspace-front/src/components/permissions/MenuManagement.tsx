import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import { SystemMenuNode } from '../../types';
import { adminService } from '../../services/admin';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../lib/errors';
import { hasSystemPermission } from '../../lib/systemPermissions';
import { useUser } from '../../contexts/UserContext';
import { ICON_OPTIONS, MENU_TYPE_OPTIONS, ROUTE_KEY_OPTIONS } from './config';

type MenuFormState = {
  id?: string;
  parentId?: string;
  code: string;
  name: string;
  type: 'menu' | 'page' | 'action';
  routeKey?: string;
  icon?: string;
  sortOrder: number;
  enabled: boolean;
};

const EMPTY_FORM: MenuFormState = {
  code: '',
  name: '',
  type: 'page',
  sortOrder: 10,
  enabled: true,
};

export function MenuManagement() {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [menus, setMenus] = useState<SystemMenuNode[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [expandedMenuIds, setExpandedMenuIds] = useState<string[]>([]);
  const [createOriginId, setCreateOriginId] = useState<string | null>(null);
  const [form, setForm] = useState<MenuFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const canCreate = hasSystemPermission(currentUser, 'permission.menu.create');
  const canEdit = hasSystemPermission(currentUser, 'permission.menu.edit');
  const canDelete = hasSystemPermission(currentUser, 'permission.menu.delete');

  const flatMenus = useMemo(() => flattenMenus(menus), [menus]);
  const selectedMenu = selectedMenuId ? flatMenus.find((item) => item.id === selectedMenuId) : undefined;
  const isCreating = !form.id;
  const expandedMenuIdSet = useMemo(() => new Set(expandedMenuIds), [expandedMenuIds]);

  useEffect(() => {
    void loadMenus();
  }, []);

  useEffect(() => {
    if (!selectedMenu) {
      return;
    }
    setForm({
      id: selectedMenu.id,
      parentId: selectedMenu.parentId,
      code: selectedMenu.code,
      name: selectedMenu.name,
      type: selectedMenu.type,
      routeKey: selectedMenu.routeKey,
      icon: selectedMenu.icon,
      sortOrder: selectedMenu.sortOrder,
      enabled: selectedMenu.enabled,
    });
    setCreateOriginId(null);
  }, [selectedMenu]);

  const expandAncestorMenus = (tree: SystemMenuNode[], targetId: string) => {
    const ancestorIds = findAncestorIds(tree, targetId) ?? [];
    if (!ancestorIds.length) {
      return;
    }
    setExpandedMenuIds((current) => Array.from(new Set([...current, ...ancestorIds])));
  };

  async function loadMenus(preferredSelectedId?: string | null) {
    try {
      const data = await adminService.listMenuTree();
      setMenus(data);
      const nextSelectedId = resolvePreferredId(data, preferredSelectedId === undefined ? selectedMenuId : preferredSelectedId);
      setSelectedMenuId(nextSelectedId);
      if (nextSelectedId) {
        expandAncestorMenus(data, nextSelectedId);
      } else {
        setForm(EMPTY_FORM);
      }
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '菜单加载失败',
        description: getErrorMessage(error, '菜单加载失败'),
      });
    }
  }

  const handleSelectMenu = (id: string) => {
    setSelectedMenuId(id);
    setCreateOriginId(null);
    expandAncestorMenus(menus, id);
  };

  const handleToggleExpanded = (id: string) => {
    setExpandedMenuIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const resetToCreate = (parentId?: string) => {
    setCreateOriginId(selectedMenuId);
    setSelectedMenuId(null);
    setForm({
      ...EMPTY_FORM,
      parentId,
      sortOrder: 10,
    });
  };

  const handleCancelCreate = () => {
    const fallbackId = resolvePreferredId(menus, createOriginId ?? selectedMenuId);
    setCreateOriginId(null);
    setSelectedMenuId(fallbackId);
    if (fallbackId) {
      expandAncestorMenus(menus, fallbackId);
    } else {
      setForm(EMPTY_FORM);
    }
  };

  const handleSubmit = async () => {
    setBusy(true);
    try {
      if (form.id) {
        const updated = await adminService.updateMenu(form.id, form);
        pushToast({ tone: 'success', title: '菜单已更新', description: `${updated.name} 已保存。` });
        await loadMenus(updated.id);
      } else {
        const created = await adminService.createMenu(form);
        pushToast({ tone: 'success', title: '菜单已创建', description: `${created.name} 已加入菜单树。` });
        setCreateOriginId(null);
        await loadMenus(created.id);
      }
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '保存失败',
        description: getErrorMessage(error, '菜单保存失败'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) {
      return;
    }
    setBusy(true);
    try {
      await adminService.deleteMenu(form.id);
      pushToast({ tone: 'success', title: '菜单已删除', description: `${form.name} 已从菜单树移除。` });
      setCreateOriginId(null);
      await loadMenus();
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '删除失败',
        description: getErrorMessage(error, '菜单删除失败'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-900">菜单树</h3>
          <p className="mt-1 text-xs text-slate-400">默认折叠展示系统菜单、页面和按钮权限点，按需展开查看。</p>
        </div>

        <div className="custom-scrollbar max-h-[62vh] overflow-auto pr-2">
          <MenuTree
            menus={menus}
            selectedId={selectedMenuId}
            expandedIds={expandedMenuIdSet}
            onSelect={handleSelectMenu}
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
              新增一级菜单
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{form.id ? '编辑菜单资源' : '创建菜单资源'}</h3>
            <p className="mt-1 text-sm text-slate-500">页面类型需要绑定固定路由键，按钮权限点不绑定路由。</p>
          </div>
          {form.id && canDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600"
            >
              <Trash2 size={16} />
              删除
            </button>
          ) : null}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="资源编码">
            <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="资源名称">
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="资源类型">
            <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as MenuFormState['type'] }))} className={inputClass}>
              {MENU_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="父级菜单">
            <select value={form.parentId ?? ''} onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value || undefined }))} className={inputClass}>
              <option value="">无父级</option>
              {flatMenus.filter((item) => item.type !== 'action' && item.id !== form.id).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="路由键">
            <select
              value={form.routeKey ?? ''}
              disabled={form.type !== 'page'}
              onChange={(event) => setForm((current) => ({ ...current, routeKey: event.target.value || undefined }))}
              className={inputClass}
            >
              <option value="">请选择</option>
              {ROUTE_KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="图标">
            <select value={form.icon ?? ''} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value || undefined }))} className={inputClass}>
              <option value="">无图标</option>
              {ICON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="排序值">
            <input
              type="number"
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
              className={inputClass}
            />
          </Field>
          <Field label="启用状态">
            <select value={String(form.enabled)} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.value === 'true' }))} className={inputClass}>
              <option value="true">启用</option>
              <option value="false">停用</option>
            </select>
          </Field>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          {canCreate && form.id ? (
            <button type="button" onClick={() => resetToCreate(form.parentId)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">
              新建同级
            </button>
          ) : null}
          {canCreate && isCreating ? (
            <button type="button" onClick={handleCancelCreate} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">
              取消
            </button>
          ) : null}
          {canEdit || canCreate ? (
            <button
              type="button"
              disabled={busy || (!form.id && !canCreate) || (!!form.id && !canEdit)}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Save size={16} />
              {busy ? '保存中...' : '保存菜单'}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MenuTree({
  menus,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpanded,
  onCreateChild,
}: {
  menus: SystemMenuNode[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onCreateChild?: (parentId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {menus.map((menu) => {
        const hasChildren = menu.children.length > 0;
        const expanded = expandedIds.has(menu.id);

        return (
          <div key={menu.id}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggleExpanded(menu.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <span className="block h-8 w-8 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelect(menu.id)}
                className={`flex min-w-0 flex-1 items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  selectedId === menu.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                }`}
              >
                <span className="min-w-0 truncate">
                  {menu.name}
                  <span className="ml-2 text-[10px] uppercase text-slate-400">{menu.type}</span>
                </span>
              </button>
              {onCreateChild && menu.type !== 'action' ? (
                <button
                  type="button"
                  onClick={() => onCreateChild(menu.id)}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200"
                >
                  子级
                </button>
              ) : null}
            </div>
            {hasChildren && expanded ? (
              <div className="ml-4 mt-2 border-l border-slate-100 pl-3">
                <MenuTree
                  menus={menu.children}
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

function flattenMenus(menus: SystemMenuNode[]): SystemMenuNode[] {
  const result: SystemMenuNode[] = [];
  const walk = (nodes: SystemMenuNode[]) => {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children.length) {
        walk(node.children);
      }
    });
  };
  walk(menus);
  return result;
}

function resolvePreferredId(menus: SystemMenuNode[], preferredId?: string | null) {
  const flat = flattenMenus(menus);
  if (preferredId && flat.some((item) => item.id === preferredId)) {
    return preferredId;
  }
  return menus[0]?.id ?? null;
}

function findAncestorIds(menus: SystemMenuNode[], targetId: string, path: string[] = []): string[] | null {
  for (const menu of menus) {
    if (menu.id === targetId) {
      return path;
    }
    if (menu.children.length) {
      const nested = findAncestorIds(menu.children, targetId, [...path, menu.id]);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
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
