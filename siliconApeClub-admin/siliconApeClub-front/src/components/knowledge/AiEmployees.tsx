import React from 'react';
import { Briefcase, Building2, Contact, Plus, RefreshCw, Save, ShieldCheck, Users } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { AdminDepartment, AiEmployee, CustomerVisibility, OrgHumanCenterOverview, PositionPackage } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { cx } from '../../lib/format';

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
  modelConfigJson: '{"modelProfileCode":"default_generalist"}',
  hrRoleCode: 'specialist',
  managerEmployeeId: '',
  employmentType: 'ai_employee',
  costRate: '0',
  performanceStatus: 'trial',
  enabled: true,
  packageIds: [],
};

const EMPTY_OVERVIEW: OrgHumanCenterOverview = {
  departments: [],
  positions: [],
  roles: [],
  modelProfiles: [],
  employees: [],
  customers: [],
  customerRoles: [],
  customerDepartmentVisibility: [],
  customerEmployeeVisibility: [],
};

export function AiEmployees({ defaultSection = 'employees' }: { defaultSection?: CenterSection }) {
  const toast = useToast();
  const [section, setSection] = React.useState<CenterSection>(defaultSection);
  const [overview, setOverview] = React.useState<OrgHumanCenterOverview>(EMPTY_OVERVIEW);
  const [packages, setPackages] = React.useState<PositionPackage[]>([]);
  const [form, setForm] = React.useState<AiEmployeeForm>(EMPTY_FORM);
  const [selectedEmployee, setSelectedEmployee] = React.useState<AiEmployee | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const departmentTree = React.useMemo(() => buildDepartmentTree(overview.departments), [overview.departments]);
  const employeeCost = React.useMemo(
    () => overview.employees.reduce((sum, employee) => sum + Number(employee.costRate ?? 0), 0),
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
    setForm({ ...EMPTY_FORM, departmentId: overview.departments[0]?.id ?? '' });
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
      });
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
      toast.pushToast({ title: form.id ? '员工配置已更新' : '员工已创建', tone: 'success' });
      setSelectedEmployee(null);
      setForm({ ...EMPTY_FORM, departmentId: form.departmentId });
      await load();
    } catch (error) {
      toast.pushToast({ title: '保存失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsSaving(false);
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
        <Metric icon={Users} label="AI 员工" value={overview.employees.length} />
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
                <DepartmentNode key={department.id} department={department} employees={overview.employees} level={0} />
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
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
                <JsonBox label="技能 JSON" value={form.skillsJson} onChange={(value) => setForm({ ...form, skillsJson: value })} />
                <JsonBox label="记忆策略 JSON" value={form.memoryPolicyJson} onChange={(value) => setForm({ ...form, memoryPolicyJson: value })} />
                <JsonBox label="模型配置 JSON" value={form.modelConfigJson} onChange={(value) => setForm({ ...form, modelConfigJson: value })} />
              </div>

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
            </section>

            <section className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {isLoading ? <div className="p-8 text-center text-sm text-slate-500">加载中...</div> : null}
              {!isLoading && overview.employees.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">暂无 AI 员工</div> : null}
              {overview.employees.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-blue-600" />
                      <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{item.performanceStatus || item.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.code} · {item.departmentName || '未配置部门'} · {item.roleTitle || item.positionCode || '未配置岗位'} · 成本 {item.costRate ?? 0}
                    </p>
                  </div>
                  <button onClick={() => void startEdit(item)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-700">配置</button>
                </div>
              ))}
            </section>
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

function DepartmentNode({ department, employees, level }: { department: AdminDepartment; employees: AiEmployee[]; level: number }) {
  const directEmployees = employees.filter((employee) => employee.departmentId === department.id);
  return (
    <div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2" style={{ marginLeft: level * 14 }}>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-slate-800">{department.name}</p>
          <span className="shrink-0 text-[11px] font-bold uppercase text-slate-400">{department.unitType || 'department'}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{directEmployees.length} 名员工 · {department.code}</p>
      </div>
      {department.children.map((child) => (
        <DepartmentNode key={child.id} department={child} employees={employees} level={level + 1} />
      ))}
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
  const [departmentIds, setDepartmentIds] = React.useState<Set<string>>(new Set());
  const [employeeRules, setEmployeeRules] = React.useState<EmployeeVisibilityDraft>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const selectedCustomer = overview.customers.find((customer) => customer.id === selectedCustomerId);

  React.useEffect(() => {
    if (!selectedCustomerId && overview.customers[0]) {
      setSelectedCustomerId(overview.customers[0].id);
    }
  }, [overview.customers, selectedCustomerId]);

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

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">客户可见性配置</h2>
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
              <p className="mt-1 text-xs text-slate-500">{item.customerName} · {item.visibilityType}{mode === 'employee' && item.roleTitle ? ` · ${item.roleTitle}` : ''}</p>
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

function tabClass(active: boolean) {
  return cx(
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold',
    active ? 'bg-blue-700 text-white' : 'border border-slate-200 text-slate-700'
  );
}
