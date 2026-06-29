import React from 'react';
import { Briefcase, Building2, Contact, EyeOff, Plus, RefreshCw, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { AdminDepartment, AiEmployee, CustomerVisibility, EmployeeAssessmentRule, OrgHumanCenterOverview, PositionPackage } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { cx } from '../../lib/format';
import { FormDialog } from '../ui/FormDialog';

type CenterSection = 'employees' | 'customers';

type EmployeeVisibilityDraft = Record<string, { visible: boolean; canConsult: boolean; canAssign: boolean }>;

type AiEmployeeForm = {
  id?: string;
  code: string;
  name: string;
  description: string;
  positionCode: string;
  departmentId: string;
  roleTitle: string;
  responsibilities: string;
  skillsJson: string;
  contactRelationsJson: string;
  memoryPolicyJson: string;
  modelConfigJson: string;
  hrRoleCode: string;
  managerEmployeeId: string;
  employmentType: string;
  costRate: string;
  performanceStatus: string;
  enabled: boolean;
  packageIds: string[];
  skillIds: string[];
  assessmentRules: EmployeeAssessmentRule[];
};

const EMPTY_FORM: AiEmployeeForm = {
  code: '',
  name: '',
  description: '',
  positionCode: 'customer_service_specialist',
  departmentId: '',
  roleTitle: '',
  responsibilities: '',
  skillsJson: '[]',
  contactRelationsJson: '[]',
  memoryPolicyJson: '{"retention":"task_scoped","writeBack":"candidate"}',
  modelConfigJson: '{"modelProfileCode":"worker_chat_llm"}',
  hrRoleCode: 'specialist',
  managerEmployeeId: '',
  employmentType: 'ai_employee',
  costRate: '0',
  performanceStatus: 'trial',
  enabled: true,
  packageIds: [],
  skillIds: [],
  assessmentRules: [],
};

const EMPTY_OVERVIEW: OrgHumanCenterOverview = {
  departments: [],
  positions: [],
  roles: [],
  modelProfiles: [],
  employees: [],
  skills: [],
  customers: [],
  customerRoles: [],
  customerDepartmentVisibility: [],
  customerEmployeeVisibility: [],
  customerRoleDepartmentVisibility: [],
  customerRoleEmployeeVisibility: [],
};

export function AiEmployees({ defaultSection = 'employees' }: { defaultSection?: CenterSection }) {
  const toast = useToast();
  const { currentUser } = useUser();
  const [section, setSection] = React.useState<CenterSection>(defaultSection);
  const [overview, setOverview] = React.useState<OrgHumanCenterOverview>(EMPTY_OVERVIEW);
  const [packages, setPackages] = React.useState<PositionPackage[]>([]);
  const [form, setForm] = React.useState<AiEmployeeForm>(EMPTY_FORM);
  const [selectedEmployee, setSelectedEmployee] = React.useState<AiEmployee | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = React.useState('');
  const [showOffline, setShowOffline] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const departmentTree = React.useMemo(() => buildDepartmentTree(overview.departments), [overview.departments]);
  const activeEmployees = React.useMemo(
    () => overview.employees.filter((employee) => showOffline || isActiveEmployee(employee)),
    [overview.employees, showOffline]
  );
  const activeEmployeeCount = React.useMemo(
    () => overview.employees.filter(isActiveEmployee).length,
    [overview.employees]
  );
  const selectedDepartment = overview.departments.find((department) => department.id === selectedDepartmentId);
  const visibleDepartmentIds = React.useMemo(
    () => selectedDepartmentId ? collectDepartmentIds(overview.departments, selectedDepartmentId) : [],
    [overview.departments, selectedDepartmentId]
  );
  const filteredEmployees = React.useMemo(
    () => visibleDepartmentIds.length
      ? activeEmployees.filter((employee) => employee.departmentId && visibleDepartmentIds.includes(employee.departmentId))
      : activeEmployees,
    [activeEmployees, visibleDepartmentIds]
  );
  const approvedSkills = React.useMemo(
    () => overview.skills.filter((skill) => skill.reviewStatus === 'approved' && skill.enabled && (isTopManager(currentUser) || skill.skillLevel !== 'advanced')),
    [overview.skills, currentUser]
  );
  const workerChatModelProfiles = React.useMemo(
    () => overview.modelProfiles.filter((profile) => profile.enabled && (!profile.purpose || profile.purpose === 'worker_chat')),
    [overview.modelProfiles]
  );
  const selectedModelProfileCode = React.useMemo(() => readModelProfileCode(form.modelConfigJson), [form.modelConfigJson]);
  const employeeCost = React.useMemo(
    () => overview.employees.filter(isActiveEmployee).reduce((sum, employee) => sum + Number(employee.costRate ?? 0), 0),
    [overview.employees]
  );

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextOverview, nextPackages] = await Promise.all([
        knowledgeApi.getOrgHumanCenter(),
        knowledgeApi.listPositionPackages(),
      ]);
      setOverview(nextOverview);
      setPackages(nextPackages);
      setForm((current) => ({
        ...current,
        departmentId: current.departmentId || nextOverview.departments[0]?.id || '',
      }));
      setSelectedDepartmentId((current) => current || nextOverview.departments[0]?.id || '');
    } catch (error) {
      toast.pushToast({ title: '组织与人力中心加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setSection(defaultSection);
  }, [defaultSection]);

  const startCreate = () => {
    setSelectedEmployee(null);
    setForm({ ...EMPTY_FORM, departmentId: selectedDepartmentId || overview.departments[0]?.id || '' });
    setEditorOpen(true);
  };

  const startEdit = async (item: AiEmployee) => {
    try {
      const detail = await knowledgeApi.getAiEmployee(item.id);
      setSelectedEmployee(detail);
      setSection('employees');
      setForm({
        id: detail.id,
        code: detail.code,
        name: detail.name,
        description: detail.description ?? '',
        positionCode: detail.positionCode ?? 'customer_service_specialist',
        departmentId: detail.departmentId ?? overview.departments[0]?.id ?? '',
        roleTitle: detail.roleTitle ?? '',
        responsibilities: detail.responsibilities ?? '',
        skillsJson: prettyJson(detail.skillsJson, '[]'),
        contactRelationsJson: prettyJson(detail.contactRelationsJson, '[]'),
        memoryPolicyJson: prettyJson(detail.memoryPolicyJson, EMPTY_FORM.memoryPolicyJson),
        modelConfigJson: prettyJson(detail.modelConfigJson, EMPTY_FORM.modelConfigJson),
        hrRoleCode: detail.hrRoleCode ?? 'specialist',
        managerEmployeeId: detail.managerEmployeeId ?? '',
        employmentType: detail.employmentType ?? 'ai_employee',
        costRate: String(detail.costRate ?? 0),
        performanceStatus: detail.performanceStatus ?? 'trial',
        enabled: detail.enabled,
        packageIds: (detail.packages ?? []).map((pkg) => pkg.id),
        skillIds: (detail.skills ?? []).map((skill) => skill.skillId),
        assessmentRules: detail.assessmentRules?.length ? detail.assessmentRules : defaultAssessmentRules(detail),
      });
      setEditorOpen(true);
    } catch (error) {
      toast.pushToast({ title: '读取员工配置失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const togglePackage = (packageId: string) => {
    setForm((current) => ({
      ...current,
      packageIds: current.packageIds.includes(packageId)
        ? current.packageIds.filter((item) => item !== packageId)
        : [...current.packageIds, packageId],
    }));
  };

  const toggleSkill = (skillId: string) => {
    setForm((current) => ({
      ...current,
      skillIds: current.skillIds.includes(skillId)
        ? current.skillIds.filter((item) => item !== skillId)
        : [...current.skillIds, skillId],
    }));
  };

  const updateAssessmentRule = (index: number, patch: Partial<EmployeeAssessmentRule>) => {
    setForm((current) => ({
      ...current,
      assessmentRules: current.assessmentRules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule),
    }));
  };

  const addAssessmentRule = () => {
    setForm((current) => ({
      ...current,
      assessmentRules: [
        ...current.assessmentRules,
        { metricKey: '', metricLabel: '', metricType: 'count', targetValue: 0, weight: 1, unit: 'count', enabled: true },
      ],
    }));
  };

  const removeAssessmentRule = (index: number) => {
    setForm((current) => ({
      ...current,
      assessmentRules: current.assessmentRules.filter((_, ruleIndex) => ruleIndex !== index),
    }));
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.pushToast({ title: '请输入员工编码和名称', tone: 'error' });
      return;
    }
    if (!form.departmentId) {
      toast.pushToast({ title: '请选择部门', tone: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        positionCode: form.positionCode.trim(),
        departmentId: form.departmentId ? Number(form.departmentId) : undefined,
        roleTitle: form.roleTitle.trim(),
        responsibilities: form.responsibilities.trim(),
        skillsJson: form.skillsJson.trim(),
        contactRelationsJson: form.contactRelationsJson.trim(),
        memoryPolicyJson: form.memoryPolicyJson.trim(),
        modelConfigJson: form.modelConfigJson.trim(),
        hrRoleCode: form.hrRoleCode,
        managerEmployeeId: form.managerEmployeeId ? Number(form.managerEmployeeId) : undefined,
        employmentType: form.employmentType,
        costRate: Number(form.costRate || 0),
        performanceStatus: form.performanceStatus,
        enabled: form.enabled,
      } as unknown as Partial<AiEmployee>;
      const saved = form.id
        ? await knowledgeApi.updateAiEmployee(form.id, payload)
        : await knowledgeApi.createAiEmployee(payload);
      await knowledgeApi.updateAiEmployeePackages(saved.id, form.packageIds);
      await knowledgeApi.updateAiEmployeeSkills(saved.id, form.skillIds);
      await knowledgeApi.updateAiEmployeeAssessmentRules(saved.id, form.assessmentRules);
      toast.pushToast({ title: form.id ? '员工配置已更新' : '员工已创建', tone: 'success' });
      setSelectedEmployee(null);
      setForm({ ...EMPTY_FORM, departmentId: form.departmentId });
      setEditorOpen(false);
      await load();
    } catch (error) {
      toast.pushToast({ title: '保存失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const offlineEmployee = async (item: AiEmployee) => {
    if (!window.confirm(`确认将 ${item.name} 标记为离职/下线？个人记忆会被清理，知识资产作者归属不变。`)) {
      return;
    }
    try {
      await knowledgeApi.offlineAiEmployee(item.id, '管理端离职/下线');
      toast.pushToast({ title: '员工已下线，个人记忆已清理', tone: 'success' });
      if (form.id === item.id) {
        setSelectedEmployee(null);
        setEditorOpen(false);
        setForm({ ...EMPTY_FORM, departmentId: form.departmentId });
      }
      await load();
    } catch (error) {
      toast.pushToast({ title: '员工下线失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">组织与人力中心</h1>
          <p className="text-sm text-slate-500">统一配置硅基猿猴俱乐部组织、岗位、AI 员工、岗位知识包、客户可见性和模型偏好。</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSection('employees')} className={tabClass(section === 'employees')}>
            <Users size={16} />
            员工组织
          </button>
          <button onClick={() => setSection('customers')} className={tabClass(section === 'customers')}>
            <ShieldCheck size={16} />
            客户会员
          </button>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
            <RefreshCw size={16} />
            刷新
          </button>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric icon={Building2} label="组织单元" value={overview.departments.length} />
        <Metric icon={Users} label="在岗 AI 员工" value={activeEmployeeCount} />
        <Metric icon={Contact} label="客户会员" value={overview.customers.length} />
        <Metric icon={Briefcase} label="小时成本基线" value={employeeCost.toFixed(0)} />
      </section>

      {section === 'employees' ? (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">公司组织</h2>
              <span className="text-xs font-medium text-slate-500">{overview.roles.length} 个角色</span>
            </div>
            {isLoading ? <p className="py-6 text-center text-sm text-slate-500">加载中...</p> : null}
            {!isLoading && departmentTree.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">暂无组织单元</p> : null}
            <div className="space-y-2">
              {departmentTree.map((department) => (
                <DepartmentNode
                  key={department.id}
                  department={department}
                  employees={activeEmployees}
                  selectedDepartmentId={selectedDepartmentId}
                  onSelect={setSelectedDepartmentId}
                  level={0}
                />
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selectedDepartment?.name || '全部组织'} · 员工列表</h2>
                  <p className="mt-1 text-xs text-slate-500">{filteredEmployees.length} 名员工 · 默认隐藏离职/下线员工</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                    <input type="checkbox" checked={showOffline} onChange={(event) => setShowOffline(event.target.checked)} />
                    显示离职/下线
                  </label>
                  <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white">
                    <Plus size={15} />
                    新建员工
                  </button>
                </div>
              </div>
              {isLoading ? <div className="p-8 text-center text-sm text-slate-500">加载中...</div> : null}
              {!isLoading && filteredEmployees.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">暂无员工</div> : null}
              <div className="divide-y divide-slate-100">
                {filteredEmployees.map((item) => (
                  <div key={item.id} className="grid gap-4 p-4 xl:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Users size={16} className="text-blue-600" />
                        <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                        <StatusPill employee={item} />
                        {item.skillCount ? <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">{item.skillCount} 技能</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.code} · {item.departmentName || '未配置部门'} · {item.roleTitle || item.positionCode || '未配置岗位'} · Token {item.totalTokens ?? 0} · 记忆 {item.memoryItems ?? 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => void startEdit(item)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-700">配置</button>
                      {isActiveEmployee(item) ? (
                        <button onClick={() => void offlineEmployee(item)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-bold text-rose-700">
                          <EyeOff size={14} />
                          下线
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <FormDialog
              isOpen={editorOpen}
              title={form.id ? '编辑 AI 员工' : '创建 AI 员工'}
              description="配置员工归属、岗位知识、技能、模型 Profile、记忆策略和考核规则。"
              widthClassName="max-w-6xl"
              onClose={() => setEditorOpen(false)}
            >
              <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">{form.id ? '编辑 AI 员工' : '创建 AI 员工'}</h2>
                <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-bold text-blue-700">
                  <Plus size={15} />
                  新建
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="员工编码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="员工名称" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                <input value={form.roleTitle} onChange={(event) => setForm({ ...form, roleTitle: event.target.value })} placeholder="岗位头衔" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                <select value={form.performanceStatus} onChange={(event) => setForm({ ...form, performanceStatus: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
                  <option value="trial">试运行</option>
                  <option value="active">稳定运行</option>
                  <option value="paused">暂停</option>
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
                  <option value="">选择部门</option>
                  {overview.departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
                <select value={form.positionCode} onChange={(event) => setForm({ ...form, positionCode: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
                  {overview.positions.map((position) => (
                    <option key={String(position.code)} value={String(position.code)}>{String(position.name ?? position.code)}</option>
                  ))}
                </select>
                <select value={form.hrRoleCode} onChange={(event) => setForm({ ...form, hrRoleCode: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
                  {overview.roles.map((role) => (
                    <option key={role.code} value={role.code}>{role.name}</option>
                  ))}
                </select>
                <select value={form.managerEmployeeId} onChange={(event) => setForm({ ...form, managerEmployeeId: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
                  <option value="">无直属上级</option>
                  {overview.employees.filter((employee) => employee.id !== form.id).map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <input value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value })} placeholder="用工类型" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                <input type="number" min="0" value={form.costRate} onChange={(event) => setForm({ ...form, costRate: event.target.value })} placeholder="小时成本" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
                  启用员工
                </label>
              </div>

              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="一句话说明员工边界" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
              <textarea value={form.responsibilities} onChange={(event) => setForm({ ...form, responsibilities: event.target.value })} placeholder="职责说明" className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />

              <div className="grid gap-3 lg:grid-cols-3">
                <JsonBox label="记忆策略 JSON" value={form.memoryPolicyJson} onChange={(value) => setForm({ ...form, memoryPolicyJson: value })} />
                <label className="grid gap-1 text-xs font-bold text-slate-600">
                  模型 Profile
                  <select
                    value={selectedModelProfileCode}
                    onChange={(event) => setForm({ ...form, modelConfigJson: writeModelProfileCode(form.modelConfigJson, event.target.value) })}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700 outline-none"
                  >
                    <option value="">请选择模型 Profile</option>
                    {workerChatModelProfiles.map((profile) => (
                      <option key={profile.code} value={profile.code}>{profile.name} · {profile.modelName}</option>
                    ))}
                  </select>
                </label>
                <JsonBox label="模型配置 JSON（高级）" value={form.modelConfigJson} onChange={(value) => setForm({ ...form, modelConfigJson: value })} />
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">员工技能</p>
                  <span className="text-xs font-medium text-slate-500">仅可绑定审核通过技能</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {approvedSkills.map((skill) => (
                    <label key={skill.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                      <input type="checkbox" checked={form.skillIds.includes(skill.id)} onChange={() => toggleSkill(skill.id)} className="mt-1" />
                      <span>
                        <span className="block font-bold text-slate-900">{skill.name}</span>
                        <span className="block text-xs text-slate-500">{skill.skillType} · {skill.skillLevel} · {skill.departmentName || '未绑定部门'}</span>
                      </span>
                    </label>
                  ))}
                  {approvedSkills.length === 0 ? <p className="text-sm text-slate-500">暂无审核通过技能。</p> : null}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">考核规则</p>
                  <button onClick={addAssessmentRule} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-bold text-blue-700">
                    <Plus size={14} />
                    增加规则
                  </button>
                </div>
                <div className="grid gap-2">
                  {form.assessmentRules.map((rule, index) => (
                    <div key={`${rule.metricKey}-${index}`} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 lg:grid-cols-[1fr_1fr_110px_110px_90px_auto]">
                      <input value={rule.metricKey} onChange={(event) => updateAssessmentRule(index, { metricKey: event.target.value })} placeholder="指标编码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                      <input value={rule.metricLabel} onChange={(event) => updateAssessmentRule(index, { metricLabel: event.target.value })} placeholder="指标名称" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                      <input type="number" value={rule.targetValue} onChange={(event) => updateAssessmentRule(index, { targetValue: Number(event.target.value || 0) })} placeholder="目标值" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                      <input type="number" step="0.1" value={rule.weight} onChange={(event) => updateAssessmentRule(index, { weight: Number(event.target.value || 0) })} placeholder="权重" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                      <input value={rule.unit} onChange={(event) => updateAssessmentRule(index, { unit: event.target.value })} placeholder="单位" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                      <button onClick={() => removeAssessmentRule(index)} className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-2.5 py-2 text-rose-700">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {form.assessmentRules.length === 0 ? <p className="text-sm text-slate-500">暂无考核规则。</p> : null}
                </div>
              </div>

              {selectedEmployee?.performance ? <PerformancePanel performance={selectedEmployee.performance} /> : null}

              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => void save()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  <Save size={16} />
                  {isSaving ? '保存中...' : '保存配置'}
                </button>
                <span className="text-xs text-slate-500">保存后 worker platform 会在启动或重启时投影为运行时员工数据。</span>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {packages.map((pkg) => (
                  <label key={pkg.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                    <input type="checkbox" checked={form.packageIds.includes(pkg.id)} onChange={() => togglePackage(pkg.id)} className="mt-1" />
                    <span>
                      <span className="block font-bold text-slate-900">{pkg.name}</span>
                      <span className="block text-xs text-slate-500">{pkg.code} · {pkg.positionCode || '未绑定岗位'} · {pkg.status}</span>
                    </span>
                  </label>
                ))}
                {packages.length === 0 ? <p className="text-sm text-slate-500">暂无岗位知识包。</p> : null}
              </div>

              {selectedEmployee?.contacts?.length ? (
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-bold text-slate-900">联系人关系</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEmployee.contacts.map((contact) => (
                      <span key={contact.id} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {contact.relationType} · {contact.relatedEmployeeName}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              </div>
            </FormDialog>

          </div>
        </div>
      ) : (
        <CustomerCenter overview={overview} onVisibilitySaved={setOverview} />
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <Icon size={18} className="text-blue-600" />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function DepartmentNode({
  department,
  employees,
  selectedDepartmentId,
  onSelect,
  level,
}: {
  department: AdminDepartment;
  employees: AiEmployee[];
  selectedDepartmentId: string;
  onSelect: (departmentId: string) => void;
  level: number;
}) {
  const directEmployees = employees.filter((employee) => employee.departmentId === department.id);
  const active = selectedDepartmentId === department.id;
  return (
    <div>
      <button
        onClick={() => onSelect(department.id)}
        className={cx(
          'w-full rounded-lg border px-3 py-2 text-left transition',
          active ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
        )}
        style={{ marginLeft: level * 14 }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-slate-800">{department.name}</p>
          <span className="shrink-0 text-[11px] font-bold uppercase text-slate-400">{department.unitType || 'department'}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{directEmployees.length} 名员工 · {department.code}</p>
      </button>
      {department.children.map((child) => (
        <DepartmentNode
          key={child.id}
          department={child}
          employees={employees}
          selectedDepartmentId={selectedDepartmentId}
          onSelect={onSelect}
          level={level + 1}
        />
      ))}
    </div>
  );
}

function StatusPill({ employee }: { employee: AiEmployee }) {
  const active = isActiveEmployee(employee);
  return (
    <span className={cx(
      'rounded-lg px-2 py-0.5 text-[11px] font-bold',
      active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
    )}>
      {active ? (employee.performanceStatus || 'active') : 'offline'}
    </span>
  );
}

function PerformancePanel({ performance }: { performance: NonNullable<AiEmployee['performance']> }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="mb-3 text-sm font-bold text-slate-900">绩效与成本</p>
      <div className="grid gap-3 md:grid-cols-4">
        <MiniMetric label="Token 消耗" value={performance.usage.totalTokens} />
        <MiniMetric label="记忆容量" value={`${performance.usage.memoryItems} 项`} />
        <MiniMetric label="任务数" value={performance.workerTaskCount} />
        <MiniMetric label="沉淀候选" value={performance.wikiProposalCount} />
      </div>
      <div className="mt-4 grid gap-2">
        {performance.rules.map((rule) => (
          <div key={rule.metricKey} className="grid gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 md:grid-cols-[1fr_auto_auto]">
            <span className="font-bold text-slate-800">{rule.metricLabel}</span>
            <span>目标 {rule.targetValue} {rule.unit}</span>
            <span>当前 {rule.actualValue ?? 0} {rule.unit}</span>
          </div>
        ))}
        {performance.rules.length === 0 ? <p className="text-sm text-slate-500">暂无可用绩效指标。</p> : null}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function JsonBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-28 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs font-normal text-slate-700 outline-none" />
    </label>
  );
}

function CustomerCenter({
  overview,
  onVisibilitySaved,
}: {
  overview: OrgHumanCenterOverview;
  onVisibilitySaved: (overview: OrgHumanCenterOverview) => void;
}) {
  const toast = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = React.useState('');
  const [selectedRoleId, setSelectedRoleId] = React.useState('');
  const [departmentIds, setDepartmentIds] = React.useState<Set<string>>(new Set());
  const [roleDepartmentIds, setRoleDepartmentIds] = React.useState<Set<string>>(new Set());
  const [employeeRules, setEmployeeRules] = React.useState<EmployeeVisibilityDraft>({});
  const [roleEmployeeRules, setRoleEmployeeRules] = React.useState<EmployeeVisibilityDraft>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSavingRole, setIsSavingRole] = React.useState(false);
  const selectedCustomer = overview.customers.find((customer) => customer.id === selectedCustomerId);
  const selectedRole = overview.customerRoles.find((role) => role.id === selectedRoleId);

  React.useEffect(() => {
    if (!selectedCustomerId && overview.customers[0]) {
      setSelectedCustomerId(overview.customers[0].id);
    }
  }, [overview.customers, selectedCustomerId]);

  React.useEffect(() => {
    if (!selectedRoleId && overview.customerRoles[0]) {
      setSelectedRoleId(overview.customerRoles[0].id);
    }
  }, [overview.customerRoles, selectedRoleId]);

  React.useEffect(() => {
    if (!selectedCustomerId) {
      return;
    }
    setDepartmentIds(new Set(
      overview.customerDepartmentVisibility
        .filter((item) => item.customerId === selectedCustomerId && item.departmentId)
        .map((item) => item.departmentId as string)
    ));
    const nextRules: EmployeeVisibilityDraft = {};
    overview.employees.forEach((employee) => {
      const match = overview.customerEmployeeVisibility.find((item) => item.customerId === selectedCustomerId && item.aiEmployeeId === employee.id);
      nextRules[employee.id] = {
        visible: Boolean(match),
        canConsult: Boolean(match?.canConsult),
        canAssign: Boolean(match?.canAssign),
      };
    });
    setEmployeeRules(nextRules);
  }, [overview, selectedCustomerId]);

  React.useEffect(() => {
    if (!selectedRoleId) {
      return;
    }
    setRoleDepartmentIds(new Set(
      overview.customerRoleDepartmentVisibility
        .filter((item) => item.roleId === selectedRoleId && item.departmentId)
        .map((item) => item.departmentId as string)
    ));
    const nextRules: EmployeeVisibilityDraft = {};
    overview.employees.forEach((employee) => {
      const match = overview.customerRoleEmployeeVisibility.find((item) => item.roleId === selectedRoleId && item.aiEmployeeId === employee.id);
      nextRules[employee.id] = {
        visible: Boolean(match),
        canConsult: Boolean(match?.canConsult),
        canAssign: Boolean(match?.canAssign),
      };
    });
    setRoleEmployeeRules(nextRules);
  }, [overview, selectedRoleId]);

  const toggleDepartment = (departmentId: string) => {
    setDepartmentIds((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) {
        next.delete(departmentId);
      } else {
        next.add(departmentId);
      }
      return next;
    });
  };

  const toggleRoleDepartment = (departmentId: string) => {
    setRoleDepartmentIds((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) {
        next.delete(departmentId);
      } else {
        next.add(departmentId);
      }
      return next;
    });
  };

  const updateEmployeeRule = (employeeId: string, patch: Partial<EmployeeVisibilityDraft[string]>) => {
    setEmployeeRules((current) => {
      const existing = current[employeeId] ?? { visible: false, canConsult: false, canAssign: false };
      const next = { ...existing, ...patch };
      if (!next.visible) {
        next.canConsult = false;
        next.canAssign = false;
      }
      if ((patch.canConsult || patch.canAssign) && !next.visible) {
        next.visible = true;
      }
      return { ...current, [employeeId]: next };
    });
  };

  const updateRoleEmployeeRule = (employeeId: string, patch: Partial<EmployeeVisibilityDraft[string]>) => {
    setRoleEmployeeRules((current) => {
      const existing = current[employeeId] ?? { visible: false, canConsult: false, canAssign: false };
      const next = { ...existing, ...patch };
      if (!next.visible) {
        next.canConsult = false;
        next.canAssign = false;
      }
      if ((patch.canConsult || patch.canAssign) && !next.visible) {
        next.visible = true;
      }
      return { ...current, [employeeId]: next };
    });
  };

  const saveVisibility = async () => {
    if (!selectedCustomerId) {
      toast.pushToast({ title: '请选择客户', tone: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const nextOverview = await knowledgeApi.updateCustomerVisibility(selectedCustomerId, {
        departmentIds: Array.from(departmentIds),
        employees: Object.entries(employeeRules)
          .filter(([, rule]) => rule.visible)
          .map(([aiEmployeeId, rule]) => ({ aiEmployeeId, canConsult: rule.canConsult, canAssign: rule.canAssign })),
      });
      onVisibilitySaved(nextOverview);
      toast.pushToast({ title: '客户可见性已保存', tone: 'success' });
    } catch (error) {
      toast.pushToast({ title: '客户可见性保存失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveRoleVisibility = async () => {
    if (!selectedRoleId) {
      toast.pushToast({ title: '请选择客户角色', tone: 'error' });
      return;
    }
    setIsSavingRole(true);
    try {
      const nextOverview = await knowledgeApi.updateCustomerRoleVisibility(selectedRoleId, {
        departmentIds: Array.from(roleDepartmentIds),
        employees: Object.entries(roleEmployeeRules)
          .filter(([, rule]) => rule.visible)
          .map(([aiEmployeeId, rule]) => ({ aiEmployeeId, canConsult: rule.canConsult, canAssign: rule.canAssign })),
      });
      onVisibilitySaved(nextOverview);
      toast.pushToast({ title: '客户角色默认可见性已保存', tone: 'success' });
    } catch (error) {
      toast.pushToast({ title: '客户角色默认可见性保存失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsSavingRole(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">客户角色默认可见性</h2>
            <p className="mt-1 text-xs text-slate-500">{selectedRole ? `${selectedRole.name} · ${selectedRole.code}` : '请选择客户角色'}</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
              {overview.customerRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            <button onClick={() => void saveRoleVisibility()} disabled={isSavingRole || !selectedRoleId} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <Save size={16} />
              {isSavingRole ? '保存中...' : '保存默认规则'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <div>
            <p className="mb-2 text-sm font-bold text-slate-900">默认可见部门</p>
            <div className="grid gap-2">
              {overview.departments.map((department) => (
                <label key={department.id} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <input type="checkbox" checked={roleDepartmentIds.has(department.id)} onChange={() => toggleRoleDepartment(department.id)} className="mt-1" />
                  <span>
                    <span className="block font-bold text-slate-800">{department.name}</span>
                    <span className="text-xs text-slate-500">{department.code} · {department.unitType || 'department'}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-slate-900">默认可见员工</p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {overview.employees.map((employee) => {
                const rule = roleEmployeeRules[employee.id] ?? { visible: false, canConsult: false, canAssign: false };
                return (
                  <div key={employee.id} className="grid gap-3 p-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{employee.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{employee.departmentName || '未配置部门'} · {employee.roleTitle || employee.positionCode || '未配置岗位'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600">
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" checked={rule.visible} onChange={(event) => updateRoleEmployeeRule(employee.id, { visible: event.target.checked })} />
                        可见
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" checked={rule.canConsult} onChange={(event) => updateRoleEmployeeRule(employee.id, { canConsult: event.target.checked, visible: event.target.checked || rule.visible })} />
                        咨询
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" checked={rule.canAssign} onChange={(event) => updateRoleEmployeeRule(employee.id, { canAssign: event.target.checked, visible: event.target.checked || rule.visible })} />
                        派活
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">客户会员附加可见性</h2>
            <p className="mt-1 text-xs text-slate-500">{selectedCustomer ? `${selectedCustomer.name} · ${selectedCustomer.principalCode || '未绑定登录主体'}` : '请选择客户'}</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
              {overview.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
            <button onClick={() => void saveVisibility()} disabled={isSaving || !selectedCustomerId} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <Save size={16} />
              {isSaving ? '保存中...' : '保存可见性'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <div>
            <p className="mb-2 text-sm font-bold text-slate-900">可见部门</p>
            <div className="grid gap-2">
              {overview.departments.map((department) => (
                <label key={department.id} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <input type="checkbox" checked={departmentIds.has(department.id)} onChange={() => toggleDepartment(department.id)} className="mt-1" />
                  <span>
                    <span className="block font-bold text-slate-800">{department.name}</span>
                    <span className="text-xs text-slate-500">{department.code} · {department.unitType || 'department'}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-slate-900">可见员工</p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {overview.employees.map((employee) => {
                const rule = employeeRules[employee.id] ?? { visible: false, canConsult: false, canAssign: false };
                return (
                  <div key={employee.id} className="grid gap-3 p-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{employee.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{employee.departmentName || '未配置部门'} · {employee.roleTitle || employee.positionCode || '未配置岗位'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600">
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" checked={rule.visible} onChange={(event) => updateEmployeeRule(employee.id, { visible: event.target.checked })} />
                        可见
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" checked={rule.canConsult} onChange={(event) => updateEmployeeRule(employee.id, { canConsult: event.target.checked, visible: event.target.checked || rule.visible })} />
                        咨询
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" checked={rule.canAssign} onChange={(event) => updateEmployeeRule(employee.id, { canAssign: event.target.checked, visible: event.target.checked || rule.visible })} />
                        派活
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">客户会员</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {overview.customers.map((customer) => (
            <div key={customer.id} className="py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{customer.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{customer.code} · {customer.customerType} · 登录主体 {customer.principalCode || '未绑定'}</p>
                </div>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{customer.status}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{customer.contactName || '未配置联系人'} · {customer.contactEmail || '未配置邮箱'}</p>
            </div>
          ))}
          {overview.customers.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">暂无客户会员</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">客户角色</h2>
        <div className="mt-4 grid gap-3">
          {overview.customerRoles.map((role) => (
            <div key={role.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-bold text-slate-900">{role.name}</p>
              <p className="mt-1 text-xs text-slate-500">{role.code} · {role.description || '未配置说明'}</p>
            </div>
          ))}
        </div>
      </section>

      <VisibilityPanel title="角色默认可见部门" items={overview.customerRoleDepartmentVisibility} mode="department" />
      <VisibilityPanel title="角色默认可见员工" items={overview.customerRoleEmployeeVisibility} mode="employee" />
      <VisibilityPanel title="客户可见部门" items={overview.customerDepartmentVisibility} mode="department" />
      <VisibilityPanel title="客户可见员工" items={overview.customerEmployeeVisibility} mode="employee" />
    </div>
  );
}

function VisibilityPanel({ title, items, mode }: { title: string; items: CustomerVisibility[]; mode: 'department' | 'employee' }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <div className="mt-4 divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{mode === 'department' ? item.departmentName : item.employeeName}</p>
              <p className="mt-1 text-xs text-slate-500">{item.customerName || item.roleName || item.roleCode} · {item.visibilityType}{mode === 'employee' && item.roleTitle ? ` · ${item.roleTitle}` : ''}</p>
            </div>
            {mode === 'employee' ? (
              <div className="flex gap-2 text-[11px] font-bold">
                <span className={cx('rounded-lg px-2 py-1', item.canConsult ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>咨询</span>
                <span className={cx('rounded-lg px-2 py-1', item.canAssign ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500')}>派活</span>
              </div>
            ) : null}
          </div>
        ))}
        {items.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">暂无可见性配置</p> : null}
      </div>
    </section>
  );
}

function buildDepartmentTree(items: AdminDepartment[]) {
  const nodes = new Map<string, AdminDepartment>();
  items.forEach((item) => nodes.set(item.id, { ...item, children: [] }));
  const roots: AdminDepartment[] = [];
  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function collectDepartmentIds(items: AdminDepartment[], rootId: string) {
  const tree = buildDepartmentTree(items);
  const result: string[] = [];
  const walk = (department: AdminDepartment) => {
    result.push(department.id);
    department.children.forEach(walk);
  };
  const find = (nodes: AdminDepartment[]): AdminDepartment | undefined => {
    for (const node of nodes) {
      if (node.id === rootId) {
        return node;
      }
      const match = find(node.children);
      if (match) {
        return match;
      }
    }
    return undefined;
  };
  const root = find(tree);
  if (root) {
    walk(root);
  }
  return result;
}

function isActiveEmployee(employee: AiEmployee) {
  return employee.enabled && String(employee.status || '').toUpperCase() !== 'OFFLINE' && employee.performanceStatus !== 'offline';
}

function isTopManager(user: ReturnType<typeof useUser>['currentUser']) {
  return user?.role === 'admin' || Boolean(user?.roles?.some((role) => role.adminRole));
}

function defaultAssessmentRules(employee: AiEmployee): EmployeeAssessmentRule[] {
  if (employee.roleTitle?.includes('测试') || employee.positionCode?.includes('test')) {
    return [
      { metricKey: 'requirement_count', metricLabel: '需求数量', metricType: 'count', targetValue: 10, weight: 0.3, unit: 'item', enabled: true },
      { metricKey: 'bug_report_count', metricLabel: '提出 Bug 数', metricType: 'count', targetValue: 8, weight: 0.25, unit: 'item', enabled: true },
      { metricKey: 'test_case_count', metricLabel: '用例数量', metricType: 'count', targetValue: 20, weight: 0.25, unit: 'item', enabled: true },
      { metricKey: 'test_report_count', metricLabel: '测试报告数量', metricType: 'count', targetValue: 4, weight: 0.2, unit: 'item', enabled: true },
    ];
  }
  if (employee.positionCode?.includes('developer') || employee.roleTitle?.includes('研发')) {
    return [
      { metricKey: 'code_lines', metricLabel: '代码量', metricType: 'count', targetValue: 1000, weight: 0.2, unit: 'line', enabled: true },
      { metricKey: 'bug_fix_count', metricLabel: '修复 Bug 数', metricType: 'count', targetValue: 8, weight: 0.25, unit: 'item', enabled: true },
      { metricKey: 'document_count', metricLabel: '文档数量', metricType: 'count', targetValue: 4, weight: 0.2, unit: 'item', enabled: true },
      { metricKey: 'delivered_requirement_count', metricLabel: '实现需求数量', metricType: 'count', targetValue: 6, weight: 0.35, unit: 'item', enabled: true },
    ];
  }
  return [
    { metricKey: 'requirement_intake_count', metricLabel: '需求接待数量', metricType: 'count', targetValue: 20, weight: 0.35, unit: 'item', enabled: true },
    { metricKey: 'route_accuracy_count', metricLabel: '路由准确数量', metricType: 'count', targetValue: 16, weight: 0.35, unit: 'item', enabled: true },
    { metricKey: 'customer_followup_count', metricLabel: '客户跟进数量', metricType: 'count', targetValue: 20, weight: 0.3, unit: 'item', enabled: true },
  ];
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

function readModelProfileCode(value: string) {
  try {
    const parsed = JSON.parse(value || '{}') as { modelProfileCode?: string };
    return parsed.modelProfileCode ?? '';
  } catch {
    return '';
  }
}

function writeModelProfileCode(value: string, modelProfileCode: string) {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(value || '{}') as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  parsed.modelProfileCode = modelProfileCode;
  return JSON.stringify(parsed, null, 2);
}

function tabClass(active: boolean) {
  return cx(
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold',
    active ? 'bg-blue-700 text-white' : 'border border-slate-200 text-slate-700'
  );
}
