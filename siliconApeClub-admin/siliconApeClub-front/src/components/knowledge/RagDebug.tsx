import React from 'react';
import { Database, Link2Off, RefreshCw, Save, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { AiEmployee, IndexedChunk, RagAclBinding, RagAclPolicy } from '../../types';
import { useToast } from '../../contexts/ToastContext';

type ChunkGovernanceForm = {
  aclPolicyId: string;
  securityLevel: string;
  departmentTags: string;
  positionTags: string;
  knowledgeStatus: string;
};

type PolicyForm = {
  policyName: string;
  securityLevel: string;
  status: string;
};

export function RagDebug() {
  const toast = useToast();
  const [query, setQuery] = React.useState('');
  const [actorId, setActorId] = React.useState('1');
  const [departmentId, setDepartmentId] = React.useState('2');
  const [positionCode, setPositionCode] = React.useState('product_manager');
  const [employees, setEmployees] = React.useState<AiEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState('');
  const [indexedChunks, setIndexedChunks] = React.useState<IndexedChunk[]>([]);
  const [policies, setPolicies] = React.useState<RagAclPolicy[]>([]);
  const [bindings, setBindings] = React.useState<RagAclBinding[]>([]);
  const [overview, setOverview] = React.useState<Record<string, unknown>>({});
  const [chunkForms, setChunkForms] = React.useState<Record<string, ChunkGovernanceForm>>({});
  const [policyForms, setPolicyForms] = React.useState<Record<string, PolicyForm>>({});
  const [newPolicy, setNewPolicy] = React.useState<PolicyForm>({ policyName: '', securityLevel: 'internal', status: 'active' });
  const [newBinding, setNewBinding] = React.useState({ policyId: '', principalType: 'department', principalId: '', action: 'use_in_rag', effect: 'allow' });
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const didHydrateDefaultsRef = React.useRef(false);

  const loadConsoleData = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [nextEmployees, nextChunks, nextPolicies, nextBindings, nextOverview] = await Promise.all([
        knowledgeApi.listAiEmployees(),
        knowledgeApi.listIndexedChunks(),
        knowledgeApi.listRagAclPolicies(),
        knowledgeApi.listRagAclBindings(),
        knowledgeApi.getRagOverview(),
      ]);
      setEmployees(nextEmployees);
      setIndexedChunks(nextChunks);
      setPolicies(nextPolicies);
      setBindings(nextBindings);
      setOverview(nextOverview);
      setChunkForms(Object.fromEntries(nextChunks.map((chunk) => [chunk.id, toChunkForm(chunk)])));
      setPolicyForms(Object.fromEntries(nextPolicies.map((policy) => [policy.id, toPolicyForm(policy)])));
      if (!didHydrateDefaultsRef.current && nextEmployees[0]) {
        applyEmployee(nextEmployees[0]);
      }
      if (!didHydrateDefaultsRef.current && nextChunks[0]) {
        setQuery(buildChunkQuery(nextChunks[0]));
      }
      if (!newBinding.policyId && nextPolicies[0]) {
        setNewBinding((current) => ({ ...current, policyId: nextPolicies[0].id }));
      }
      didHydrateDefaultsRef.current = true;
    } catch (error) {
      toast.pushToast({ title: 'RAG 管理台加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  }, [newBinding.policyId, toast]);

  React.useEffect(() => {
    void loadConsoleData();
  }, [loadConsoleData]);

  const applyEmployee = (employee: AiEmployee) => {
    setSelectedEmployeeId(employee.id);
    setActorId(employee.id);
    setDepartmentId(employee.departmentId ?? '2');
    setPositionCode(employee.positionCode ?? 'product_manager');
  };

  const chooseEmployee = (id: string) => {
    const employee = employees.find((item) => item.id === id);
    if (employee) {
      applyEmployee(employee);
    }
  };

  const run = async () => {
    if (!query.trim()) {
      toast.pushToast({ title: '请输入检索问题或选择一条入库知识', tone: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      const data = await knowledgeApi.searchRetrieval({
        query,
        actor: { type: 'AI_EMPLOYEE', id: actorId, departmentId, positionCode },
        task: { type: 'knowledge_debug', projectId: 'sac-management-console', riskLevel: 'low' },
        policy: { topK: 20, rerankTopN: 8, requireCitation: true },
      });
      setResult(data);
    } catch (error) {
      toast.pushToast({ title: 'RAG 管理台查询失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const createPolicy = async () => {
    if (!newPolicy.policyName.trim()) {
      toast.pushToast({ title: '请输入权限策略名称', tone: 'error' });
      return;
    }
    try {
      await knowledgeApi.createRagAclPolicy(newPolicy);
      setNewPolicy({ policyName: '', securityLevel: 'internal', status: 'active' });
      toast.pushToast({ title: 'RAG 权限策略已创建', tone: 'success' });
      await loadConsoleData();
    } catch (error) {
      toast.pushToast({ title: '创建策略失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const savePolicy = async (policy: RagAclPolicy) => {
    try {
      await knowledgeApi.updateRagAclPolicy(policy.id, policyForms[policy.id]);
      toast.pushToast({ title: 'RAG 权限策略已更新', tone: 'success' });
      await loadConsoleData();
    } catch (error) {
      toast.pushToast({ title: '更新策略失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const createBinding = async () => {
    if (!newBinding.policyId || !newBinding.principalId.trim()) {
      toast.pushToast({ title: '请选择策略并填写授权主体', tone: 'error' });
      return;
    }
    try {
      await knowledgeApi.createRagAclBinding(newBinding);
      setNewBinding((current) => ({ ...current, principalId: '' }));
      toast.pushToast({ title: 'RAG 权限绑定已创建', tone: 'success' });
      await loadConsoleData();
    } catch (error) {
      toast.pushToast({ title: '创建绑定失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const deleteBinding = async (binding: RagAclBinding) => {
    try {
      await knowledgeApi.deleteRagAclBinding(binding.id);
      toast.pushToast({ title: 'RAG 权限绑定已移除', tone: 'success' });
      await loadConsoleData();
    } catch (error) {
      toast.pushToast({ title: '移除绑定失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const saveChunkGovernance = async (chunk: IndexedChunk) => {
    try {
      await knowledgeApi.updateIndexedChunkGovernance(chunk.id, chunkForms[chunk.id]);
      toast.pushToast({ title: 'Chunk 权限治理已更新', tone: 'success' });
      await loadConsoleData();
    } catch (error) {
      toast.pushToast({ title: '更新 chunk 失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const results = Array.isArray(result?.results) ? (result.results as Array<Record<string, unknown>>) : [];
  const debug = result?.debug && typeof result.debug === 'object' ? result.debug as Record<string, unknown> : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">RAG 管理台</h1>
          <p className="text-sm text-slate-500">统一管理 RAG 调试回放、索引可见性、chunk 权限标签、ACL 策略和授权绑定。</p>
        </div>
        <button onClick={() => void loadConsoleData()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
          <RefreshCw size={16} />
          {isRefreshing ? '刷新中' : '刷新'}
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-5">
        <Metric label="Active Chunk" value={overview.activeChunks} />
        <Metric label="ACL Policy" value={overview.policies} />
        <Metric label="Binding" value={overview.bindings} />
        <Metric label="Citation" value={overview.citations} />
        <Metric label="Failed Sync" value={overview.failedSyncJobs} />
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 xl:grid-cols-[1fr_240px_120px_140px_160px_auto]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入问题，或点击下方入库知识自动带入" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
        <select value={selectedEmployeeId} onChange={(event) => chooseEmployee(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
          <option value="">手动填写 AI 员工</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.name} / {employee.positionCode || '未配置岗位'}</option>
          ))}
        </select>
        <input value={actorId} onChange={(event) => setActorId(event.target.value)} placeholder="AI ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
        <input value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} placeholder="部门 ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
        <input value={positionCode} onChange={(event) => setPositionCode(event.target.value)} placeholder="岗位编码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
        <button onClick={() => void run()} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          <Search size={16} />
          {isLoading ? '检索中' : '调试'}
        </button>
      </section>

      {result ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-blue-600" />
              <p className="font-bold text-slate-900">Trace: {String(result.traceId)}</p>
            </div>
            {debug ? <p className="text-xs text-slate-500">候选 {String(debug.candidateCount)} · rerank {String(debug.rerankedCount)} · {String(debug.queryEmbeddingProvider)}</p> : null}
          </div>
          <div className="mt-4 space-y-3">
            {results.length === 0 ? <p className="text-sm text-slate-500">无召回结果，请确认部门、岗位、ACL 策略与入库知识标签匹配。</p> : null}
            {results.map((item) => (
              <div key={String(item.chunkId)} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">{String(item.sourceTitle)}</p>
                <p className="mt-1 text-xs text-slate-500">chunk {String(item.chunkId)} · wiki {String(item.wikiPageId ?? '-')} · score {String(item.score)} · rerank {String(item.rerankScore)} · {String(item.permissionMatchedBy)}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{String(item.content)}</p>
                <p className="mt-2 text-xs text-blue-700">{String(item.whySelected)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4">
          <Database size={18} className="text-blue-600" />
          <h2 className="font-bold text-slate-900">索引 Chunk 治理</h2>
          <span className="text-xs text-slate-400">active chunks: {indexedChunks.length}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {indexedChunks.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">暂无 active chunk，请先推送文档或发布 Wiki。</div> : null}
          {indexedChunks.slice(0, 12).map((chunk) => {
            const form = chunkForms[chunk.id] ?? toChunkForm(chunk);
            return (
              <div key={chunk.id} className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_150px_130px_130px_130px_auto]">
                <button type="button" onClick={() => setQuery(buildChunkQuery(chunk))} className="min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{chunk.sourceType}</span>
                    <span className="text-sm font-bold text-slate-900">{chunk.sourceTitle}</span>
                    <span className="text-xs text-slate-400">chunk {chunk.id}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{chunk.preview}</p>
                </button>
                <select value={form.aclPolicyId} onChange={(event) => patchChunkForm(chunk.id, { aclPolicyId: event.target.value }, setChunkForms)} className={inputClass}>
                  <option value="">无策略</option>
                  {policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.policyName}</option>)}
                </select>
                <input value={form.departmentTags} onChange={(event) => patchChunkForm(chunk.id, { departmentTags: event.target.value }, setChunkForms)} placeholder="部门标签" className={inputClass} />
                <input value={form.positionTags} onChange={(event) => patchChunkForm(chunk.id, { positionTags: event.target.value }, setChunkForms)} placeholder="岗位标签" className={inputClass} />
                <select value={form.knowledgeStatus} onChange={(event) => patchChunkForm(chunk.id, { knowledgeStatus: event.target.value }, setChunkForms)} className={inputClass}>
                  <option value="active">active</option>
                  <option value="deprecated">deprecated</option>
                  <option value="archived">archived</option>
                </select>
                <button type="button" onClick={() => void saveChunkGovernance(chunk)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">
                  <Save size={15} />
                  保存
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-4">
            <ShieldCheck size={18} className="text-blue-600" />
            <h2 className="font-bold text-slate-900">ACL 权限策略</h2>
          </div>
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_130px_110px_auto]">
            <input value={newPolicy.policyName} onChange={(event) => setNewPolicy((current) => ({ ...current, policyName: event.target.value }))} placeholder="策略名称" className={inputClass} />
            <input value={newPolicy.securityLevel} onChange={(event) => setNewPolicy((current) => ({ ...current, securityLevel: event.target.value }))} placeholder="密级" className={inputClass} />
            <select value={newPolicy.status} onChange={(event) => setNewPolicy((current) => ({ ...current, status: event.target.value }))} className={inputClass}>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
            <button type="button" onClick={() => void createPolicy()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">新建策略</button>
          </div>
          <div className="divide-y divide-slate-100">
            {policies.map((policy) => {
              const form = policyForms[policy.id] ?? toPolicyForm(policy);
              return (
                <div key={policy.id} className="grid gap-3 p-4 md:grid-cols-[1fr_130px_110px_auto]">
                  <input value={form.policyName} onChange={(event) => patchPolicyForm(policy.id, { policyName: event.target.value }, setPolicyForms)} className={inputClass} />
                  <input value={form.securityLevel} onChange={(event) => patchPolicyForm(policy.id, { securityLevel: event.target.value }, setPolicyForms)} className={inputClass} />
                  <select value={form.status} onChange={(event) => patchPolicyForm(policy.id, { status: event.target.value }, setPolicyForms)} className={inputClass}>
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </select>
                  <button type="button" onClick={() => void savePolicy(policy)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">保存</button>
                  <p className="text-xs text-slate-500 md:col-span-4">版本 {policy.aclVersion} · 绑定 {policy.bindingCount ?? 0} · active chunk {policy.activeChunkCount ?? 0}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-4">
            <ShieldCheck size={18} className="text-blue-600" />
            <h2 className="font-bold text-slate-900">授权绑定</h2>
          </div>
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_130px_1fr_120px_auto]">
            <select value={newBinding.policyId} onChange={(event) => setNewBinding((current) => ({ ...current, policyId: event.target.value }))} className={inputClass}>
              <option value="">选择策略</option>
              {policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.policyName}</option>)}
            </select>
            <select value={newBinding.principalType} onChange={(event) => setNewBinding((current) => ({ ...current, principalType: event.target.value }))} className={inputClass}>
              <option value="department">department</option>
              <option value="position">position</option>
              <option value="ai_employee">ai_employee</option>
              <option value="role">role</option>
            </select>
            <input value={newBinding.principalId} onChange={(event) => setNewBinding((current) => ({ ...current, principalId: event.target.value }))} placeholder="主体 ID/编码" className={inputClass} />
            <select value={newBinding.effect} onChange={(event) => setNewBinding((current) => ({ ...current, effect: event.target.value }))} className={inputClass}>
              <option value="allow">allow</option>
              <option value="deny">deny</option>
            </select>
            <button type="button" onClick={() => void createBinding()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">新增绑定</button>
          </div>
          <div className="divide-y divide-slate-100">
            {bindings.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">暂无授权绑定。</div> : null}
            {bindings.map((binding) => (
              <div key={binding.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{binding.policyName || `policy ${binding.policyId}`}</p>
                  <p className="mt-1 text-xs text-slate-500">{binding.principalType}:{binding.principalId} · {binding.action} · {binding.effect}</p>
                </div>
                <button type="button" onClick={() => void deleteBinding(binding)} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600">
                  <Link2Off size={14} />
                  移除
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{String(value ?? 0)}</p>
    </div>
  );
}

function buildChunkQuery(chunk: IndexedChunk) {
  return `${chunk.sourceTitle} ${chunk.preview}`.trim();
}

function toChunkForm(chunk: IndexedChunk): ChunkGovernanceForm {
  return {
    aclPolicyId: chunk.aclPolicyId ?? '',
    securityLevel: chunk.securityLevel ?? 'internal',
    departmentTags: chunk.departmentTags ?? '',
    positionTags: chunk.positionTags ?? '',
    knowledgeStatus: chunk.knowledgeStatus || 'active',
  };
}

function toPolicyForm(policy: RagAclPolicy): PolicyForm {
  return {
    policyName: policy.policyName,
    securityLevel: policy.securityLevel,
    status: policy.status,
  };
}

function patchChunkForm(
  id: string,
  patch: Partial<ChunkGovernanceForm>,
  setter: React.Dispatch<React.SetStateAction<Record<string, ChunkGovernanceForm>>>,
) {
  setter((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
}

function patchPolicyForm(
  id: string,
  patch: Partial<PolicyForm>,
  setter: React.Dispatch<React.SetStateAction<Record<string, PolicyForm>>>,
) {
  setter((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
}

const inputClass = 'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100';
