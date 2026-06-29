import React from 'react';
import { Archive, CheckCircle2, Plus, RefreshCw, Save, Send, XCircle } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { AdminDepartment, AiEmployee, SkillRepositoryItem } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { cx } from '../../lib/format';

type SkillForm = {
  id?: string;
  code: string;
  name: string;
  description: string;
  departmentId: string;
  skillType: string;
  skillLevel: string;
  invocationMode: string;
  inputSchemaJson: string;
  outputSchemaJson: string;
  orchestrationConfigJson: string;
  guardrailsJson: string;
  sourceType: string;
  sourceEmployeeId: string;
  reviewStatus: string;
  enabled: boolean;
};

const EMPTY_FORM: SkillForm = {
  code: '',
  name: '',
  description: '',
  departmentId: '',
  skillType: 'tool',
  skillLevel: 'basic',
  invocationMode: 'tool_call',
  inputSchemaJson: '{"type":"object","properties":{}}',
  outputSchemaJson: '{"type":"object","properties":{}}',
  orchestrationConfigJson: '{"preferredModelProfile":"default_generalist","maxSteps":4,"allowRag":true,"allowWiki":true}',
  guardrailsJson: '{"humanReviewRequired":true}',
  sourceType: 'human',
  sourceEmployeeId: '',
  reviewStatus: 'draft',
  enabled: true,
};

const BUSINESS_ACTION_PRESETS: Array<{ label: string; patch: Partial<SkillForm> }> = [
  {
    label: '业务下单',
    patch: {
      code: 'business_order_create',
      name: '业务下单',
      description: '收集商品、数量、联系人和收货地址，直接创建演示订单。',
      skillType: 'business_action',
      invocationMode: 'form_submit',
      inputSchemaJson: JSON.stringify({
        title: '业务下单',
        required: ['productName', 'quantity', 'deliveryAddress', 'contactPhone'],
        properties: {
          productName: { type: 'string', title: '商品/服务名称' },
          quantity: { type: 'number', title: '数量', default: 1 },
          deliveryAddress: { type: 'string', title: '收货/服务地址', 'ui:widget': 'textarea' },
          contactPhone: { type: 'string', title: '联系电话' },
          remark: { type: 'string', title: '备注', 'ui:widget': 'textarea' },
        },
      }, null, 2),
      outputSchemaJson: '{"type":"object","properties":{"orderId":{"type":"string"},"status":{"type":"string"}}}',
      orchestrationConfigJson: JSON.stringify({
        actionCode: 'create_order',
        formTitle: '业务下单',
        submitLabel: '提交订单',
        defaultVisible: true,
        deterministic: true,
        keywords: ['下单', '订购', '购买', 'order'],
        routeEmployeeCodes: ['frontdesk-ada', 'customer-service-01'],
        displayHtml: '<section><h3>业务下单</h3><p>请填写精确入参，提交后直接创建订单账本。</p></section>',
      }, null, 2),
      guardrailsJson: '{"externalVisible":true,"humanReviewRequired":false}',
    },
  },
  {
    label: '查订单',
    patch: {
      code: 'business_order_query',
      name: '查询订单进度',
      description: '通过订单号和联系方式查询当前订单处理进度。',
      skillType: 'business_action',
      invocationMode: 'form_submit',
      inputSchemaJson: '{"title":"查询订单进度","required":["orderId"],"properties":{"orderId":{"type":"string","title":"订单号"},"contactPhone":{"type":"string","title":"联系电话"}}}',
      outputSchemaJson: '{"type":"object","properties":{"orderId":{"type":"string"},"status":{"type":"string"}}}',
      orchestrationConfigJson: '{"actionCode":"query_order_status","formTitle":"查询订单进度","submitLabel":"查询进度","defaultVisible":true,"deterministic":true,"keywords":["订单进度","查订单","查询订单","进度","order status"],"routeEmployeeCodes":["frontdesk-ada","customer-service-01"]}',
      guardrailsJson: '{"externalVisible":true,"humanReviewRequired":false}',
    },
  },
  {
    label: '退货申请',
    patch: {
      code: 'business_return_request',
      name: '退货申请',
      description: '收集订单号、退货原因和取件信息，登记退货申请。',
      skillType: 'business_action',
      invocationMode: 'form_submit',
      inputSchemaJson: '{"title":"退货申请","required":["orderId","reason","pickupAddress"],"properties":{"orderId":{"type":"string","title":"订单号"},"reason":{"type":"string","title":"退货原因","ui:widget":"textarea"},"pickupAddress":{"type":"string","title":"取件地址","ui:widget":"textarea"},"contactPhone":{"type":"string","title":"联系电话"}}}',
      outputSchemaJson: '{"type":"object","properties":{"returnRequestId":{"type":"string"},"status":{"type":"string"}}}',
      orchestrationConfigJson: '{"actionCode":"return_request","formTitle":"退货申请","submitLabel":"提交退货申请","defaultVisible":true,"deterministic":true,"keywords":["退货","退款","售后","return"],"routeEmployeeCodes":["frontdesk-ada","customer-service-01"]}',
      guardrailsJson: '{"externalVisible":true,"humanReviewRequired":false}',
    },
  },
];

export function SkillRepository() {
  const toast = useToast();
  const { currentUser } = useUser();
  const [skills, setSkills] = React.useState<SkillRepositoryItem[]>([]);
  const [departments, setDepartments] = React.useState<AdminDepartment[]>([]);
  const [employees, setEmployees] = React.useState<AiEmployee[]>([]);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [selectedSkill, setSelectedSkill] = React.useState<SkillRepositoryItem | null>(null);
  const [form, setForm] = React.useState<SkillForm>(EMPTY_FORM);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const topManager = isTopManager(currentUser);
  const visibleSkills = React.useMemo(
    () => skills.filter((skill) => topManager || skill.skillLevel !== 'advanced'),
    [skills, topManager]
  );

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [overview, nextSkills] = await Promise.all([
        knowledgeApi.getOrgHumanCenter(),
        knowledgeApi.listSkillRepository(statusFilter),
      ]);
      setDepartments(overview.departments);
      setEmployees(overview.employees);
      setSkills(nextSkills);
      setForm((current) => ({ ...current, departmentId: current.departmentId || overview.departments[0]?.id || '' }));
    } catch (error) {
      toast.pushToast({ title: '技能仓库加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setSelectedSkill(null);
    setForm({ ...EMPTY_FORM, departmentId: departments[0]?.id || '' });
  };

  const applyPreset = (patch: Partial<SkillForm>) => {
    setSelectedSkill(null);
    setForm({
      ...EMPTY_FORM,
      departmentId: form.departmentId || departments[0]?.id || '',
      ...patch,
    });
  };

  const startEdit = async (skill: SkillRepositoryItem) => {
    try {
      const detail = await knowledgeApi.getSkillRepositoryItem(skill.id);
      setSelectedSkill(detail);
      setForm({
        id: detail.id,
        code: detail.code,
        name: detail.name,
        description: detail.description ?? '',
        departmentId: detail.departmentId ?? departments[0]?.id ?? '',
        skillType: detail.skillType,
        skillLevel: detail.skillLevel,
        invocationMode: detail.invocationMode,
        inputSchemaJson: prettyJson(detail.inputSchemaJson, EMPTY_FORM.inputSchemaJson),
        outputSchemaJson: prettyJson(detail.outputSchemaJson, EMPTY_FORM.outputSchemaJson),
        orchestrationConfigJson: prettyJson(detail.orchestrationConfigJson, EMPTY_FORM.orchestrationConfigJson),
        guardrailsJson: prettyJson(detail.guardrailsJson, EMPTY_FORM.guardrailsJson),
        sourceType: detail.sourceType,
        sourceEmployeeId: detail.sourceEmployeeId ?? '',
        reviewStatus: detail.reviewStatus,
        enabled: detail.enabled,
      });
    } catch (error) {
      toast.pushToast({ title: '读取技能失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.pushToast({ title: '请输入技能编码和名称', tone: 'error' });
      return;
    }
    if (form.skillLevel === 'advanced' && !topManager) {
      toast.pushToast({ title: '高级技能仅允许顶级管理人员维护', tone: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload: Partial<SkillRepositoryItem> = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        departmentId: form.departmentId || undefined,
        skillType: form.skillType,
        skillLevel: form.skillLevel,
        invocationMode: form.invocationMode,
        inputSchemaJson: form.inputSchemaJson.trim(),
        outputSchemaJson: form.outputSchemaJson.trim(),
        orchestrationConfigJson: form.orchestrationConfigJson.trim(),
        guardrailsJson: form.guardrailsJson.trim(),
        sourceType: form.sourceType,
        sourceEmployeeId: form.sourceEmployeeId || undefined,
        reviewStatus: form.reviewStatus,
        enabled: form.enabled,
      };
      const saved = form.id
        ? await knowledgeApi.updateSkillRepositoryItem(form.id, payload)
        : await knowledgeApi.createSkillRepositoryItem(payload);
      toast.pushToast({ title: form.id ? '技能已更新' : '技能已创建', tone: 'success' });
      await load();
      await startEdit(saved);
    } catch (error) {
      toast.pushToast({ title: '保存技能失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const action = async (handler: (id: string) => Promise<SkillRepositoryItem>, title: string) => {
    if (!form.id) {
      return;
    }
    try {
      const next = await handler(form.id);
      toast.pushToast({ title, tone: 'success' });
      await load();
      await startEdit(next);
    } catch (error) {
      toast.pushToast({ title: `${title}失败`, description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">技能仓库</h1>
          <p className="text-sm text-slate-500">维护 AI 员工可编排技能、审核状态、部门开放范围和大模型调度参数。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending_review">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
            <option value="archived">已归档</option>
          </select>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
            <RefreshCw size={16} />
            刷新
          </button>
          <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white">
            <Plus size={16} />
            新建技能
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-base font-bold text-slate-900">技能列表</h2>
            <p className="mt-1 text-xs text-slate-500">{visibleSkills.length} 个技能</p>
          </div>
          {isLoading ? <div className="p-8 text-center text-sm text-slate-500">加载中...</div> : null}
          {!isLoading && visibleSkills.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">暂无技能</div> : null}
          <div className="divide-y divide-slate-100">
            {visibleSkills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => void startEdit(skill)}
                className={cx(
                  'w-full p-4 text-left transition hover:bg-slate-50',
                  selectedSkill?.id === skill.id ? 'bg-blue-50' : 'bg-white'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-slate-900">{skill.name}</p>
                  <StatusBadge status={skill.reviewStatus} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {skill.code} · {skill.departmentName || '未绑定部门'} · {skill.skillType} · {skill.skillLevel} · {skill.bindingCount ?? 0} 绑定
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">{form.id ? '编辑技能' : '创建技能'}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => void save()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                <Save size={16} />
                {isSaving ? '保存中...' : '保存'}
              </button>
              <button onClick={() => void action(knowledgeApi.submitSkillRepositoryReview, '技能已提交审核')} disabled={!form.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
                <Send size={16} />
                提交
              </button>
              <button onClick={() => void action(knowledgeApi.approveSkillRepositoryItem, '技能已通过')} disabled={!form.id} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-50">
                <CheckCircle2 size={16} />
                通过
              </button>
              <button onClick={() => void action(knowledgeApi.rejectSkillRepositoryItem, '技能已驳回')} disabled={!form.id} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">
                <XCircle size={16} />
                驳回
              </button>
              <button onClick={() => void action(knowledgeApi.archiveSkillRepositoryItem, '技能已归档')} disabled={!form.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
                <Archive size={16} />
                归档
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-xs font-bold text-slate-500">业务表单模板</span>
            {BUSINESS_ACTION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset.patch)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="技能编码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="技能名称" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
            <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
              <option value="">不绑定部门</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
            <select value={form.skillLevel} onChange={(event) => setForm({ ...form, skillLevel: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
              <option value="basic">基础技能</option>
              <option value="advanced" disabled={!topManager}>高级技能</option>
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select value={form.skillType} onChange={(event) => setForm({ ...form, skillType: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
              <option value="tool">工具技能</option>
              <option value="planning">规划技能</option>
              <option value="diagnosis">诊断技能</option>
              <option value="business_action">业务动作表单</option>
              <option value="form_template">表单模板</option>
            </select>
            <select value={form.invocationMode} onChange={(event) => setForm({ ...form, invocationMode: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
              <option value="tool_call">工具调用</option>
              <option value="form_submit">表单提交</option>
              <option value="prompt_chain">提示链</option>
              <option value="workflow">工作流</option>
              <option value="human_handoff">人工交接</option>
            </select>
            <select value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
              <option value="human">人工维护</option>
              <option value="ai_employee">AI 员工总结</option>
            </select>
            <select value={form.sourceEmployeeId} onChange={(event) => setForm({ ...form, sourceEmployeeId: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
              <option value="">无来源员工</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </div>

          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="技能说明" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />

          <div className="grid gap-3 lg:grid-cols-2">
            <JsonBox label="输入 Schema" value={form.inputSchemaJson} onChange={(value) => setForm({ ...form, inputSchemaJson: value })} />
            <JsonBox label="输出 Schema" value={form.outputSchemaJson} onChange={(value) => setForm({ ...form, outputSchemaJson: value })} />
            <JsonBox label="编排配置" value={form.orchestrationConfigJson} onChange={(value) => setForm({ ...form, orchestrationConfigJson: value })} />
            <JsonBox label="安全规则" value={form.guardrailsJson} onChange={(value) => setForm({ ...form, guardrailsJson: value })} />
          </div>

          <label className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
            启用技能
          </label>

          {selectedSkill?.bindings?.length ? (
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-2 text-sm font-bold text-slate-900">员工绑定</p>
              <div className="flex flex-wrap gap-2">
                {selectedSkill.bindings.map((binding) => (
                  <span key={String(binding.id)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {String(binding.employeeName ?? '未知员工')}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = status === 'approved'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'pending_review'
      ? 'bg-amber-50 text-amber-700'
      : status === 'rejected'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-slate-100 text-slate-600';
  return <span className={cx('shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold', style)}>{status}</span>;
}

function isTopManager(user: ReturnType<typeof useUser>['currentUser']) {
  return user?.role === 'admin' || Boolean(user?.roles?.some((role) => role.adminRole));
}

function JsonBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-36 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs font-normal text-slate-700 outline-none" />
    </label>
  );
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
