import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Save, Search, Star, ToggleLeft, Trash2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { getErrorMessage } from '../../lib/errors';
import { hasSystemPermission } from '../../lib/systemPermissions';
import { adminService } from '../../services/admin';
import { ParseEngineBindingAdmin, RegisteredParseEngine } from '../../types';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FormDialog } from '../ui/FormDialog';
import { InlineHelpTip } from '../ui/InlineHelpTip';
import { PaginationBar } from '../ui/PaginationBar';

type ParseConfigFormState = {
  id?: string;
  fileExtension: string;
  engineCode: string;
  engineName: string;
  isDefault: boolean;
  enabled: boolean;
  sortOrder: number;
};

const EMPTY_FORM: ParseConfigFormState = {
  fileExtension: '',
  engineCode: '',
  engineName: '',
  isDefault: false,
  enabled: true,
  sortOrder: 10,
};

const PAGE_SIZE = 8;

const PAGE_HELP = '这里维护文件扩展名与后端已注册解析引擎之间的绑定关系。保存后，上传和重解析会直接读取这套数据库配置。';
const LIST_HELP = '记录型配置统一在主列表中展示，支持搜索、分页和行内状态操作。';
const FORM_HELP = '新增和编辑都通过弹窗完成，取消即可放弃本次修改。默认项在同一扩展名下始终保持唯一。';
const ENGINE_DESCRIPTION_HELP = '选择引擎后，这里会展示后端注册表里的说明信息，便于确认当前绑定的能力范围。';

export function ParseConfigSettings() {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [bindings, setBindings] = useState<ParseEngineBindingAdmin[]>([]);
  const [engines, setEngines] = useState<RegisteredParseEngine[]>([]);
  const [form, setForm] = useState<ParseConfigFormState>(EMPTY_FORM);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ParseEngineBindingAdmin | null>(null);

  const canCreate = hasSystemPermission(currentUser, 'settings.parse_config.create');
  const canEdit = hasSystemPermission(currentUser, 'settings.parse_config.edit');
  const canDelete = hasSystemPermission(currentUser, 'settings.parse_config.delete');

  const filteredBindings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return bindings;
    }
    return bindings.filter((binding) => {
      const haystack = [binding.fileExtension, binding.engineName, binding.engineCode].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [bindings, query]);

  const pagedBindings = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredBindings.slice(start, start + PAGE_SIZE);
  }, [filteredBindings, page]);

  const selectedEngineDescription = useMemo(
    () => engines.find((engine) => engine.code === form.engineCode)?.description ?? '尚未选择解析引擎。',
    [engines, form.engineCode]
  );

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredBindings.length / PAGE_SIZE));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [filteredBindings.length, page]);

  useEffect(() => {
    setForm((current) => {
      const engineName = engines.find((engine) => engine.code === current.engineCode)?.name ?? '';
      if (current.engineName === engineName) {
        return current;
      }
      return { ...current, engineName };
    });
  }, [engines]);

  async function loadData() {
    setLoading(true);
    try {
      const [nextBindings, nextEngines] = await Promise.all([
        adminService.listParseEngineBindings(),
        adminService.listRegisteredParseEngines(),
      ]);
      setBindings(nextBindings);
      setEngines(nextEngines);
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '解析配置加载失败',
        description: getErrorMessage(error, '解析配置加载失败'),
      });
    } finally {
      setLoading(false);
    }
  }

  const openCreateModal = () => {
    if (!canCreate) {
      return;
    }
    setForm(createEmptyForm(bindings));
    setEditorOpen(true);
  };

  const openEditModal = (binding: ParseEngineBindingAdmin) => {
    if (!canEdit) {
      return;
    }
    setForm(toFormState(binding, engines));
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
    if ((!form.id && !canCreate) || (form.id && !canEdit)) {
      return;
    }
    const normalizedExtension = normalizeExtension(form.fileExtension);
    if (!normalizedExtension) {
      pushToast({ tone: 'error', title: '文件扩展名不能为空' });
      return;
    }
    if (!form.engineCode) {
      pushToast({ tone: 'error', title: '请选择解析引擎' });
      return;
    }

    setBusy(true);
    try {
      const payload = {
        fileExtension: normalizedExtension,
        engineCode: form.engineCode,
        isDefault: form.isDefault,
        enabled: form.enabled,
        sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 10,
      };
      const saved = form.id
        ? await adminService.updateParseEngineBinding(form.id, payload)
        : await adminService.createParseEngineBinding(payload);
      pushToast({
        tone: 'success',
        title: form.id ? '解析绑定已更新' : '解析绑定已创建',
        description: `.${saved.fileExtension} 已绑定到 ${saved.engineName}`,
      });
      await loadData();
      closeEditor();
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '保存失败',
        description: getErrorMessage(error, '解析绑定保存失败'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !canDelete) {
      return;
    }
    setBusy(true);
    try {
      await adminService.deleteParseEngineBinding(deleteTarget.id);
      pushToast({
        tone: 'success',
        title: '解析绑定已删除',
        description: `.${deleteTarget.fileExtension} 的绑定已移除`,
      });
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '删除失败',
        description: getErrorMessage(error, '解析绑定删除失败'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSetDefault = async (binding: ParseEngineBindingAdmin) => {
    if (!canEdit || binding.isDefault) {
      return;
    }
    setBusy(true);
    try {
      await adminService.updateParseEngineBinding(binding.id, {
        fileExtension: binding.fileExtension,
        engineCode: binding.engineCode,
        isDefault: true,
        enabled: binding.enabled,
        sortOrder: binding.sortOrder,
      });
      pushToast({
        tone: 'success',
        title: '默认引擎已更新',
        description: `.${binding.fileExtension} 现在默认使用 ${binding.engineName}`,
      });
      await loadData();
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '设置默认失败',
        description: getErrorMessage(error, '默认引擎设置失败'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleEnabled = async (binding: ParseEngineBindingAdmin) => {
    if (!canEdit) {
      return;
    }
    setBusy(true);
    try {
      await adminService.updateParseEngineBinding(binding.id, {
        fileExtension: binding.fileExtension,
        engineCode: binding.engineCode,
        isDefault: binding.isDefault,
        enabled: !binding.enabled,
        sortOrder: binding.sortOrder,
      });
      pushToast({
        tone: 'success',
        title: binding.enabled ? '解析绑定已停用' : '解析绑定已启用',
        description: `.${binding.fileExtension} 的绑定状态已更新`,
      });
      await loadData();
    } catch (error) {
      pushToast({
        tone: 'error',
        title: '状态更新失败',
        description: getErrorMessage(error, '解析绑定状态更新失败'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">解析配置</h2>
            <InlineHelpTip content={PAGE_HELP} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative block w-full md:w-80">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索扩展名、引擎名称或编码"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700"
            >
              <RefreshCw size={16} />
              刷新
            </button>
            {canCreate ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"
              >
                <Plus size={16} />
                新建绑定
              </button>
            ) : null}
          </div>
        </div>

        {!engines.length && !loading ? (
          <div className="mx-5 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            当前后端没有可注册的解析引擎，解析配置暂时无法新增绑定。
          </div>
        ) : null}

        <div className="overflow-x-auto px-5 py-5">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">绑定列表</h3>
            <InlineHelpTip content={LIST_HELP} />
          </div>
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-wider text-slate-400">
                <th className="pb-3 pr-4">文件扩展名</th>
                <th className="pb-3 pr-4">引擎名称</th>
                <th className="pb-3 pr-4">引擎编码</th>
                <th className="pb-3 pr-4">默认</th>
                <th className="pb-3 pr-4">状态</th>
                <th className="pb-3 pr-4">排序</th>
                <th className="pb-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                    正在加载解析配置...
                  </td>
                </tr>
              ) : pagedBindings.length ? (
                pagedBindings.map((binding) => (
                  <tr key={binding.id} className="align-top text-slate-700">
                    <td className="py-4 pr-4 font-bold text-slate-900">.{binding.fileExtension}</td>
                    <td className="py-4 pr-4">{binding.engineName}</td>
                    <td className="py-4 pr-4 text-slate-500">{binding.engineCode}</td>
                    <td className="py-4 pr-4">
                      {binding.isDefault ? <StatusBadge tone="blue" label="默认" /> : <span className="text-slate-400">--</span>}
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge tone={binding.enabled ? 'emerald' : 'slate'} label={binding.enabled ? '启用' : '停用'} />
                    </td>
                    <td className="py-4 pr-4">{binding.sortOrder}</td>
                    <td className="py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(binding)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600"
                          >
                            <Pencil size={14} />
                            编辑
                          </button>
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            disabled={busy || binding.isDefault}
                            onClick={() => void handleSetDefault(binding)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-50"
                          >
                            <Star size={14} />
                            设为默认
                          </button>
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleEnabled(binding)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-50"
                          >
                            <ToggleLeft size={14} />
                            {binding.enabled ? '停用' : '启用'}
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDeleteTarget(binding)}
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
                    暂无匹配的解析绑定。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar page={page} pageSize={PAGE_SIZE} total={filteredBindings.length} onPageChange={setPage} />
      </section>

      <FormDialog
        isOpen={editorOpen}
        onClose={closeEditor}
        title={form.id ? '编辑绑定' : '新增绑定'}
        description={FORM_HELP}
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
                disabled={busy || !engines.length || (!form.id && !canCreate) || (!!form.id && !canEdit)}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                <Save size={16} />
                {busy ? '保存中...' : '保存绑定'}
              </button>
            ) : null}
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="文件扩展名">
            <input
              value={form.fileExtension}
              onChange={(event) => setForm((current) => ({ ...current, fileExtension: event.target.value }))}
              placeholder="例如 .pdf 或 pdf"
              className={inputClass}
            />
          </Field>

          <Field label="解析引擎">
            <select
              value={form.engineCode}
              onChange={(event) => setForm((current) => ({ ...current, engineCode: event.target.value }))}
              className={inputClass}
            >
              <option value="">请选择解析引擎</option>
              {engines.map((engine) => (
                <option key={engine.code} value={engine.code}>
                  {engine.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="引擎名称">
            <input value={form.engineName} readOnly className={`${inputClass} bg-slate-50 text-slate-500`} />
          </Field>

          <Field
            label={(
              <span className="inline-flex items-center gap-2">
                引擎说明
                <InlineHelpTip content={ENGINE_DESCRIPTION_HELP} />
              </span>
            )}
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-500">
              {selectedEngineDescription}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="排序">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))}
                className={inputClass}
              />
            </Field>
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                <span>默认引擎</span>
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                <span>启用绑定</span>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="删除解析绑定"
        description={
          deleteTarget ? `确认删除 .${deleteTarget.fileExtension} -> ${deleteTarget.engineName} 这条绑定吗？` : ''
        }
        confirmLabel="确认删除"
        tone="danger"
        busy={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

function createEmptyForm(bindings: ParseEngineBindingAdmin[]): ParseConfigFormState {
  const nextSortOrder = bindings.length ? Math.max(...bindings.map((binding) => binding.sortOrder)) + 10 : 10;
  return {
    ...EMPTY_FORM,
    enabled: true,
    sortOrder: nextSortOrder,
  };
}

function normalizeExtension(rawExtension: string) {
  return rawExtension.trim().toLowerCase().replace(/^\.+/, '');
}

function toFormState(binding: ParseEngineBindingAdmin, engines: RegisteredParseEngine[]): ParseConfigFormState {
  return {
    id: binding.id,
    fileExtension: binding.fileExtension,
    engineCode: binding.engineCode,
    engineName: engines.find((engine) => engine.code === binding.engineCode)?.name ?? binding.engineName,
    isDefault: binding.isDefault,
    enabled: binding.enabled,
    sortOrder: binding.sortOrder,
  };
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ tone, label }: { tone: 'blue' | 'emerald' | 'slate'; label: string }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-600',
  }[tone];

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${toneClass}`}>{label}</span>;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-100';
