import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, KeyRound, Pencil, RefreshCw, Save, TestTube2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { getErrorMessage } from '../../lib/errors';
import { hasSystemPermission } from '../../lib/systemPermissions';
import { adminService } from '../../services/admin';
import { AiModelProfile, AiModelProfileTestResult } from '../../types';
import { FormDialog } from '../ui/FormDialog';
import { InlineHelpTip } from '../ui/InlineHelpTip';

type FormState = {
  id: string;
  profileName: string;
  provider: string;
  purpose: string;
  endpoint: string;
  apiKey: string;
  apiKeyTouched: boolean;
  modelName: string;
  dimensions: string;
  timeoutSeconds: number;
  enabled: boolean;
  defaultProfile: boolean;
  fallbackEnabled: boolean;
  configJson: string;
};

const PURPOSE_LABELS: Record<string, string> = {
  document_to_wiki: '文档生成 LLM Wiki',
  worker_chat: 'AI 员工分析对话',
  rag_embedding: 'RAG Embedding',
  rag_rerank: 'RAG Rerank',
};

const PROVIDERS = [
  { value: 'openai_compatible', label: 'OpenAI Compatible' },
  { value: 'dashscope_rerank', label: 'DashScope Rerank' },
];

const PAGE_HELP = '统一维护大模型、Embedding 和 Rerank 配置。文档到 LLM Wiki、RAG 入库和 AI 员工分析都从这里读取默认 profile。';

export function AiModelSettings() {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [profiles, setProfiles] = useState<AiModelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [testResults, setTestResults] = useState<Record<string, AiModelProfileTestResult>>({});

  const canEdit = hasSystemPermission(currentUser, 'settings.ai_model.edit');
  const canTest = hasSystemPermission(currentUser, 'settings.ai_model.test');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      setProfiles(await adminService.listAiModelProfiles());
    } catch (error) {
      pushToast({ tone: 'error', title: 'AI 模型配置加载失败', description: getErrorMessage(error, '加载失败') });
    } finally {
      setLoading(false);
    }
  }

  function openEdit(profile: AiModelProfile) {
    if (!canEdit) {
      return;
    }
    setForm({
      id: profile.id,
      profileName: profile.profileName,
      provider: profile.provider,
      purpose: profile.purpose,
      endpoint: profile.endpoint,
      apiKey: '',
      apiKeyTouched: false,
      modelName: profile.modelName,
      dimensions: profile.dimensions == null ? '' : String(profile.dimensions),
      timeoutSeconds: profile.timeoutSeconds,
      enabled: profile.enabled,
      defaultProfile: profile.defaultProfile,
      fallbackEnabled: profile.fallbackEnabled,
      configJson: profile.configJson || '{}',
    });
    setEditorOpen(true);
  }

  async function saveProfile() {
    if (!form || !canEdit) {
      return;
    }
    setBusy(true);
    try {
      const saved = await adminService.updateAiModelProfile(form.id, {
        profileName: form.profileName,
        provider: form.provider,
        purpose: form.purpose,
        endpoint: form.endpoint,
        apiKey: form.apiKeyTouched ? form.apiKey : undefined,
        modelName: form.modelName,
        dimensions: form.dimensions.trim() ? Number(form.dimensions) : null,
        timeoutSeconds: form.timeoutSeconds,
        enabled: form.enabled,
        defaultProfile: form.defaultProfile,
        fallbackEnabled: form.fallbackEnabled,
        configJson: form.configJson,
      });
      pushToast({ tone: 'success', title: 'AI 模型配置已保存', description: `${saved.profileName} 已更新` });
      setEditorOpen(false);
      setForm(null);
      await loadData();
    } catch (error) {
      pushToast({ tone: 'error', title: '保存失败', description: getErrorMessage(error, '保存失败') });
    } finally {
      setBusy(false);
    }
  }

  async function testProfile(profile: AiModelProfile) {
    if (!canTest) {
      return;
    }
    setBusy(true);
    try {
      const result = await adminService.testAiModelProfile(profile.id);
      setTestResults((current) => ({ ...current, [profile.id]: result }));
      pushToast({ tone: result.status === 'ok' ? 'success' : 'info', title: '模型测试完成', description: result.message });
    } catch (error) {
      pushToast({ tone: 'error', title: '模型测试失败', description: getErrorMessage(error, '模型测试失败') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">AI 模型配置</h2>
            <InlineHelpTip content={PAGE_HELP} />
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700"
          >
            <RefreshCw size={16} />
            刷新
          </button>
        </div>

        <div className="grid gap-4 p-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">正在加载 AI 模型配置...</div>
          ) : profiles.map((profile) => {
            const result = testResults[profile.id];
            return (
              <article key={profile.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Bot size={18} className="text-blue-700" />
                      <h3 className="text-base font-black text-slate-900">{profile.profileName}</h3>
                      <StatusBadge label={PURPOSE_LABELS[profile.purpose] || profile.purpose} tone="blue" />
                      <StatusBadge label={profile.enabled ? '启用' : '停用'} tone={profile.enabled ? 'emerald' : 'slate'} />
                      {profile.defaultProfile ? <StatusBadge label="默认" tone="amber" /> : null}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                      <Info label="Provider" value={profile.provider} />
                      <Info label="Model" value={profile.modelName} />
                      <Info label="Endpoint" value={profile.endpoint} />
                      <Info label="API Key" value={profile.apiKeyConfigured ? profile.apiKeyMasked || '已配置' : '未配置'} />
                      <Info label="Dimensions" value={profile.dimensions == null ? '-' : String(profile.dimensions)} />
                      <Info label="Fallback" value={profile.fallbackEnabled ? '允许 fallback' : '禁止 fallback'} />
                    </div>
                    {result ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                        <b className="mr-2 text-slate-900">{result.status}</b>
                        {result.message}
                        {result.sample ? <div className="mt-1 text-slate-500">{result.sample}</div> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canTest ? (
                      <button type="button" disabled={busy} onClick={() => void testProfile(profile)} className={secondaryButtonClass}>
                        <TestTube2 size={15} />
                        测试
                      </button>
                    ) : null}
                    {canEdit ? (
                      <button type="button" onClick={() => openEdit(profile)} className={primaryButtonClass}>
                        <Pencil size={15} />
                        编辑
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <FormDialog
        isOpen={editorOpen && !!form}
        onClose={() => {
          if (!busy) {
            setEditorOpen(false);
            setForm(null);
          }
        }}
        title="编辑 AI 模型配置"
        description="密钥不会回显；不填写密钥时保存不会覆盖旧密钥，填写空白并保存表示清空密钥。"
        widthClassName="max-w-4xl"
        footer={(
          <>
            <button type="button" onClick={() => setEditorOpen(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200">
              取消
            </button>
            <button type="button" disabled={busy || !form} onClick={() => void saveProfile()} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">
              <Save size={16} />
              保存配置
            </button>
          </>
        )}
      >
        {form ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="配置名称">
              <input className={inputClass} value={form.profileName} onChange={(event) => setFormValue('profileName', event.target.value)} />
            </Field>
            <Field label="用途">
              <select className={inputClass} value={form.purpose} onChange={(event) => setFormValue('purpose', event.target.value)}>
                {Object.entries(PURPOSE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Provider">
              <select className={inputClass} value={form.provider} onChange={(event) => setFormValue('provider', event.target.value)}>
                {PROVIDERS.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
              </select>
            </Field>
            <Field label="模型名称">
              <input className={inputClass} value={form.modelName} onChange={(event) => setFormValue('modelName', event.target.value)} />
            </Field>
            <Field label="Endpoint">
              <input className={inputClass} value={form.endpoint} onChange={(event) => setFormValue('endpoint', event.target.value)} />
            </Field>
            <Field label="API Key">
              <div className="relative">
                <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${inputClass} pl-9`}
                  type="password"
                  value={form.apiKey}
                  placeholder="留空表示不修改；输入空白后保存表示清空"
                  onChange={(event) => setForm((current) => current ? { ...current, apiKey: event.target.value, apiKeyTouched: true } : current)}
                />
              </div>
            </Field>
            <Field label="Embedding 维度">
              <input className={inputClass} value={form.dimensions} onChange={(event) => setFormValue('dimensions', event.target.value)} placeholder="仅 embedding 需要，例如 1024" />
            </Field>
            <Field label="超时秒数">
              <input className={inputClass} type="number" value={form.timeoutSeconds} onChange={(event) => setForm((current) => current ? { ...current, timeoutSeconds: Number(event.target.value) || 30 } : current)} />
            </Field>
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              启用
              <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => current ? { ...current, enabled: event.target.checked } : current)} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              设为用途默认
              <input type="checkbox" checked={form.defaultProfile} onChange={(event) => setForm((current) => current ? { ...current, defaultProfile: event.target.checked } : current)} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              开发期允许 fallback
              <input type="checkbox" checked={form.fallbackEnabled} onChange={(event) => setForm((current) => current ? { ...current, fallbackEnabled: event.target.checked } : current)} />
            </label>
            <Field label="扩展 JSON">
              <textarea className={`${inputClass} min-h-[140px] font-mono`} value={form.configJson} onChange={(event) => setFormValue('configJson', event.target.value)} />
            </Field>
          </div>
        ) : null}
      </FormDialog>
    </>
  );

  function setFormValue(key: keyof FormState, value: string) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</span>
      <div className="truncate font-medium text-slate-700">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'blue' | 'emerald' | 'slate' | 'amber' }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-50 text-amber-700',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${toneClass}`}><CheckCircle2 size={12} />{label}</span>;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-100';
const primaryButtonClass = 'inline-flex items-center gap-1 rounded-xl bg-blue-700 px-3 py-2 text-sm font-bold text-white';
const secondaryButtonClass = 'inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200';
