import React from 'react';
import { CheckCircle2, CircleOff, Plus, RefreshCw, Save, Zap } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { QuickCapability, QuickCapabilityGroup, QuickCapabilityOverview } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { cx } from '../../lib/format';

type GroupForm = {
  id?: string;
  groupCode: string;
  groupName: string;
  description: string;
  groupSort: string;
  visibleToExternal: boolean;
  visibleToInternal: boolean;
  enabled: boolean;
};

type CapabilityForm = {
  id?: string;
  groupId: string;
  capabilityCode: string;
  capabilityName: string;
  description: string;
  transactionServiceCode: string;
  actionCode: string;
  formTitle: string;
  submitLabel: string;
  inputSchemaJson: string;
  displayHtml: string;
  keywordsJson: string;
  visibleToExternal: boolean;
  visibleToInternal: boolean;
  enabled: boolean;
  sortOrder: string;
};

const EMPTY_OVERVIEW: QuickCapabilityOverview = { groups: [], capabilities: [] };

const EMPTY_GROUP_FORM: GroupForm = {
  groupCode: '',
  groupName: '',
  description: '',
  groupSort: '100',
  visibleToExternal: true,
  visibleToInternal: true,
  enabled: true,
};

const EMPTY_CAPABILITY_FORM: CapabilityForm = {
  groupId: '',
  capabilityCode: '',
  capabilityName: '',
  description: '',
  transactionServiceCode: '',
  actionCode: '',
  formTitle: '',
  submitLabel: '提交',
  inputSchemaJson: '{"title":"业务表单","required":[],"properties":{}}',
  displayHtml: '',
  keywordsJson: '[]',
  visibleToExternal: true,
  visibleToInternal: true,
  enabled: true,
  sortOrder: '100',
};

export function QuickCapabilities() {
  const toast = useToast();
  const [overview, setOverview] = React.useState<QuickCapabilityOverview>(EMPTY_OVERVIEW);
  const [selectedGroupId, setSelectedGroupId] = React.useState('');
  const [selectedCapabilityId, setSelectedCapabilityId] = React.useState('');
  const [groupForm, setGroupForm] = React.useState<GroupForm>(EMPTY_GROUP_FORM);
  const [capabilityForm, setCapabilityForm] = React.useState<CapabilityForm>(EMPTY_CAPABILITY_FORM);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const selectedGroup = overview.groups.find((item) => item.id === selectedGroupId);
  const groupCapabilities = React.useMemo(
    () => overview.capabilities.filter((item) => !selectedGroupId || item.groupId === selectedGroupId),
    [overview.capabilities, selectedGroupId]
  );

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const nextOverview = await knowledgeApi.getQuickCapabilityOverview();
      setOverview(nextOverview);
      const nextGroupId = selectedGroupId || nextOverview.groups[0]?.id || '';
      setSelectedGroupId(nextGroupId);
      if (!groupForm.id && nextGroupId) {
        const group = nextOverview.groups.find((item) => item.id === nextGroupId);
        if (group) {
          setGroupForm(groupToForm(group));
        }
      }
      setCapabilityForm((current) => ({ ...current, groupId: current.groupId || nextGroupId }));
    } catch (error) {
      toast.pushToast({ title: '系统快捷能力加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [groupForm.id, selectedGroupId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selectGroup = (group: QuickCapabilityGroup) => {
    setSelectedGroupId(group.id);
    setSelectedCapabilityId('');
    setGroupForm(groupToForm(group));
    setCapabilityForm({ ...EMPTY_CAPABILITY_FORM, groupId: group.id });
  };

  const selectCapability = (capability: QuickCapability) => {
    setSelectedCapabilityId(capability.id);
    setCapabilityForm(capabilityToForm(capability));
  };

  const startNewGroup = () => {
    setSelectedGroupId('');
    setSelectedCapabilityId('');
    setGroupForm(EMPTY_GROUP_FORM);
    setCapabilityForm(EMPTY_CAPABILITY_FORM);
  };

  const startNewCapability = () => {
    setSelectedCapabilityId('');
    setCapabilityForm({ ...EMPTY_CAPABILITY_FORM, groupId: selectedGroupId || overview.groups[0]?.id || '' });
  };

  const saveGroup = async () => {
    if (!groupForm.groupCode.trim() || !groupForm.groupName.trim()) {
      toast.pushToast({ title: '请填写分组编码和名称', tone: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        groupCode: groupForm.groupCode.trim(),
        groupName: groupForm.groupName.trim(),
        description: groupForm.description.trim(),
        groupSort: Number(groupForm.groupSort || 100),
        visibleToExternal: groupForm.visibleToExternal,
        visibleToInternal: groupForm.visibleToInternal,
        enabled: groupForm.enabled,
      };
      const nextOverview = groupForm.id
        ? await knowledgeApi.updateQuickCapabilityGroup(groupForm.id, payload)
        : await knowledgeApi.createQuickCapabilityGroup(payload);
      setOverview(nextOverview);
      const saved = nextOverview.groups.find((item) => item.groupCode === payload.groupCode);
      if (saved) {
        selectGroup(saved);
      }
      toast.pushToast({ title: groupForm.id ? '分组已更新' : '分组已创建', tone: 'success' });
    } catch (error) {
      toast.pushToast({ title: '保存分组失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveCapability = async () => {
    if (!capabilityForm.groupId || !capabilityForm.capabilityCode.trim() || !capabilityForm.capabilityName.trim()) {
      toast.pushToast({ title: '请填写能力分组、编码和名称', tone: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        groupId: capabilityForm.groupId,
        capabilityCode: capabilityForm.capabilityCode.trim(),
        capabilityName: capabilityForm.capabilityName.trim(),
        description: capabilityForm.description.trim(),
        transactionServiceCode: capabilityForm.transactionServiceCode.trim(),
        actionCode: capabilityForm.actionCode.trim(),
        formTitle: capabilityForm.formTitle.trim() || capabilityForm.capabilityName.trim(),
        submitLabel: capabilityForm.submitLabel.trim() || '提交',
        inputSchemaJson: capabilityForm.inputSchemaJson.trim() || '{}',
        displayHtml: capabilityForm.displayHtml.trim(),
        keywordsJson: capabilityForm.keywordsJson.trim() || '[]',
        visibleToExternal: capabilityForm.visibleToExternal,
        visibleToInternal: capabilityForm.visibleToInternal,
        enabled: capabilityForm.enabled,
        sortOrder: Number(capabilityForm.sortOrder || 100),
      };
      const nextOverview = capabilityForm.id
        ? await knowledgeApi.updateQuickCapability(capabilityForm.id, payload)
        : await knowledgeApi.createQuickCapability(payload);
      setOverview(nextOverview);
      const saved = nextOverview.capabilities.find((item) => item.capabilityCode === payload.capabilityCode);
      if (saved) {
        setSelectedGroupId(saved.groupId);
        selectCapability(saved);
      }
      toast.pushToast({ title: capabilityForm.id ? '快捷能力已更新' : '快捷能力已创建', tone: 'success' });
    } catch (error) {
      toast.pushToast({ title: '保存快捷能力失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCapability = async (capability: QuickCapability) => {
    try {
      const nextOverview = await knowledgeApi.setQuickCapabilityEnabled(capability.id, !capability.enabled);
      setOverview(nextOverview);
      const updated = nextOverview.capabilities.find((item) => item.id === capability.id);
      if (updated) {
        selectCapability(updated);
      }
      toast.pushToast({ title: capability.enabled ? '快捷能力已停用' : '快捷能力已启用', tone: 'success' });
    } catch (error) {
      toast.pushToast({ title: '切换能力状态失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">系统快捷能力</h1>
          <p className="text-sm text-slate-500">配置客户端可见的业务系统对客接口，和 AI 员工技能仓库保持边界分离。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
            <RefreshCw size={16} />
            刷新
          </button>
          <button onClick={startNewGroup} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-bold text-blue-700">
            <Plus size={16} />
            新建分组
          </button>
          <button onClick={startNewCapability} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white">
            <Zap size={16} />
            新建能力
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(360px,1fr)_minmax(460px,1.2fr)]">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-base font-bold text-slate-900">能力分组</h2>
            <p className="mt-1 text-xs text-slate-500">{overview.groups.length} 个分组 · {overview.capabilities.length} 个能力</p>
          </div>
          {isLoading ? <div className="p-8 text-center text-sm text-slate-500">加载中...</div> : null}
          <div className="divide-y divide-slate-100">
            {overview.groups.map((group) => (
              <button
                key={group.id}
                onClick={() => selectGroup(group)}
                className={cx('w-full p-4 text-left transition hover:bg-slate-50', group.id === selectedGroupId ? 'bg-blue-50' : 'bg-white')}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-900">{group.groupName}</p>
                  <Status enabled={group.enabled} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{group.groupCode} · sort {group.groupSort}</p>
                {group.description ? <p className="mt-2 line-clamp-2 text-xs text-slate-500">{group.description}</p> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-base font-bold text-slate-900">{selectedGroup?.groupName || '全部'} · 快捷能力</h2>
            <p className="mt-1 text-xs text-slate-500">点击能力后可编辑交易编码、表单和展示规则。</p>
          </div>
          <div className="divide-y divide-slate-100">
            {groupCapabilities.map((capability) => (
              <button
                key={capability.id}
                onClick={() => selectCapability(capability)}
                className={cx('w-full p-4 text-left transition hover:bg-slate-50', selectedCapabilityId === capability.id ? 'bg-blue-50' : 'bg-white')}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-slate-900">{capability.capabilityName}</p>
                  <Status enabled={capability.enabled} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{capability.capabilityCode} · {capability.transactionServiceCode || '未配置服务编码'} · {capability.actionCode}</p>
                {capability.description ? <p className="mt-2 line-clamp-2 text-xs text-slate-500">{capability.description}</p> : null}
              </button>
            ))}
            {!isLoading && groupCapabilities.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">当前分组暂无快捷能力</div> : null}
          </div>
        </section>

        <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">{capabilityForm.id ? '编辑快捷能力' : groupForm.id ? '编辑分组 / 新建能力' : '新建分组'}</h2>
              <p className="mt-1 text-xs text-slate-500">分组和能力可分别保存。</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-bold text-slate-900">分组配置</p>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={groupForm.groupCode} onChange={(event) => setGroupForm({ ...groupForm, groupCode: event.target.value })} placeholder="分组编码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
              <input value={groupForm.groupName} onChange={(event) => setGroupForm({ ...groupForm, groupName: event.target.value })} placeholder="分组名称" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
              <input value={groupForm.groupSort} onChange={(event) => setGroupForm({ ...groupForm, groupSort: event.target.value })} placeholder="排序" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
              <VisibilityToggles
                external={groupForm.visibleToExternal}
                internal={groupForm.visibleToInternal}
                enabled={groupForm.enabled}
                onChange={(patch) => setGroupForm({ ...groupForm, ...patch })}
              />
            </div>
            <textarea value={groupForm.description} onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })} placeholder="分组说明" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
            <button onClick={() => void saveGroup()} disabled={isSaving} className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <Save size={16} />
              保存分组
            </button>
          </div>

          <div className="grid gap-3 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-bold text-slate-900">能力配置</p>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={capabilityForm.groupId} onChange={(event) => setCapabilityForm({ ...capabilityForm, groupId: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
                <option value="">选择分组</option>
                {overview.groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.groupName}</option>
                ))}
              </select>
              <input value={capabilityForm.capabilityCode} onChange={(event) => setCapabilityForm({ ...capabilityForm, capabilityCode: event.target.value })} placeholder="能力编码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
              <input value={capabilityForm.capabilityName} onChange={(event) => setCapabilityForm({ ...capabilityForm, capabilityName: event.target.value })} placeholder="能力名称" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
              <input value={capabilityForm.transactionServiceCode} onChange={(event) => setCapabilityForm({ ...capabilityForm, transactionServiceCode: event.target.value })} placeholder="交易系统服务编码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
              <input value={capabilityForm.actionCode} onChange={(event) => setCapabilityForm({ ...capabilityForm, actionCode: event.target.value })} placeholder="接口动作码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
              <input value={capabilityForm.sortOrder} onChange={(event) => setCapabilityForm({ ...capabilityForm, sortOrder: event.target.value })} placeholder="排序" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
              <input value={capabilityForm.formTitle} onChange={(event) => setCapabilityForm({ ...capabilityForm, formTitle: event.target.value })} placeholder="表单标题" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
              <input value={capabilityForm.submitLabel} onChange={(event) => setCapabilityForm({ ...capabilityForm, submitLabel: event.target.value })} placeholder="提交按钮文案" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
            </div>
            <textarea value={capabilityForm.description} onChange={(event) => setCapabilityForm({ ...capabilityForm, description: event.target.value })} placeholder="能力说明" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
            <div className="grid gap-3 lg:grid-cols-2">
              <JsonBox label="表单 Schema" value={capabilityForm.inputSchemaJson} onChange={(value) => setCapabilityForm({ ...capabilityForm, inputSchemaJson: value })} />
              <JsonBox label="关键词 JSON" value={capabilityForm.keywordsJson} onChange={(value) => setCapabilityForm({ ...capabilityForm, keywordsJson: value })} />
              <JsonBox label="展示 HTML" value={capabilityForm.displayHtml} onChange={(value) => setCapabilityForm({ ...capabilityForm, displayHtml: value })} />
              <VisibilityToggles
                external={capabilityForm.visibleToExternal}
                internal={capabilityForm.visibleToInternal}
                enabled={capabilityForm.enabled}
                onChange={(patch) => setCapabilityForm({ ...capabilityForm, ...patch })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void saveCapability()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                <Save size={16} />
                保存能力
              </button>
              <button onClick={() => capabilityForm.id && void toggleCapability(formToCapability(capabilityForm))} disabled={!capabilityForm.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
                {capabilityForm.enabled ? <CircleOff size={16} /> : <CheckCircle2 size={16} />}
                {capabilityForm.enabled ? '停用' : '启用'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Status({ enabled }: { enabled: boolean }) {
  return (
    <span className={cx('shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold', enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
      {enabled ? '启用' : '停用'}
    </span>
  );
}

function VisibilityToggles({
  external,
  internal,
  enabled,
  onChange,
}: {
  external: boolean;
  internal: boolean;
  enabled: boolean;
  onChange: (patch: Partial<Pick<GroupForm, 'visibleToExternal' | 'visibleToInternal' | 'enabled'>>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
      <label className="inline-flex items-center gap-1">
        <input type="checkbox" checked={external} onChange={(event) => onChange({ visibleToExternal: event.target.checked })} />
        外部可见
      </label>
      <label className="inline-flex items-center gap-1">
        <input type="checkbox" checked={internal} onChange={(event) => onChange({ visibleToInternal: event.target.checked })} />
        内部可见
      </label>
      <label className="inline-flex items-center gap-1">
        <input type="checkbox" checked={enabled} onChange={(event) => onChange({ enabled: event.target.checked })} />
        启用
      </label>
    </div>
  );
}

function JsonBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-32 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs font-normal text-slate-700 outline-none" />
    </label>
  );
}

function groupToForm(group: QuickCapabilityGroup): GroupForm {
  return {
    id: group.id,
    groupCode: group.groupCode,
    groupName: group.groupName,
    description: group.description ?? '',
    groupSort: String(group.groupSort ?? 100),
    visibleToExternal: group.visibleToExternal,
    visibleToInternal: group.visibleToInternal,
    enabled: group.enabled,
  };
}

function capabilityToForm(capability: QuickCapability): CapabilityForm {
  return {
    id: capability.id,
    groupId: capability.groupId,
    capabilityCode: capability.capabilityCode,
    capabilityName: capability.capabilityName,
    description: capability.description ?? '',
    transactionServiceCode: capability.transactionServiceCode,
    actionCode: capability.actionCode,
    formTitle: capability.formTitle ?? '',
    submitLabel: capability.submitLabel ?? '提交',
    inputSchemaJson: prettyJson(capability.inputSchemaJson, '{}'),
    displayHtml: capability.displayHtml ?? '',
    keywordsJson: prettyJson(capability.keywordsJson, '[]'),
    visibleToExternal: capability.visibleToExternal,
    visibleToInternal: capability.visibleToInternal,
    enabled: capability.enabled,
    sortOrder: String(capability.sortOrder ?? 100),
  };
}

function formToCapability(form: CapabilityForm): QuickCapability {
  return {
    id: form.id || '',
    groupId: form.groupId,
    capabilityCode: form.capabilityCode,
    capabilityName: form.capabilityName,
    description: form.description,
    transactionServiceCode: form.transactionServiceCode,
    actionCode: form.actionCode,
    formTitle: form.formTitle,
    submitLabel: form.submitLabel,
    inputSchemaJson: form.inputSchemaJson,
    displayHtml: form.displayHtml,
    keywordsJson: form.keywordsJson,
    visibleToExternal: form.visibleToExternal,
    visibleToInternal: form.visibleToInternal,
    enabled: form.enabled,
    sortOrder: Number(form.sortOrder || 100),
  };
}

function prettyJson(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
