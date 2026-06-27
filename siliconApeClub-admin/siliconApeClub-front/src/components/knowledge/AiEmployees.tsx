import React from 'react';
import { Plus, RefreshCw, Save, Users } from 'lucide-react';
import { adminService } from '../../services/admin';
import { knowledgeApi } from '../../services/knowledge';
import { AdminDepartment, AiEmployee, PositionPackage } from '../../types';
import { useToast } from '../../contexts/ToastContext';

type AiEmployeeForm = {
  id?: string;
  code: string;
  name: string;
  description: string;
  positionCode: string;
  departmentId: string;
  enabled: boolean;
  packageIds: string[];
};

const EMPTY_FORM: AiEmployeeForm = {
  code: '',
  name: '',
  description: '',
  positionCode: 'product_manager',
  departmentId: '2',
  enabled: true,
  packageIds: [],
};

export function AiEmployees() {
  const toast = useToast();
  const [items, setItems] = React.useState<AiEmployee[]>([]);
  const [packages, setPackages] = React.useState<PositionPackage[]>([]);
  const [departments, setDepartments] = React.useState<AdminDepartment[]>([]);
  const [form, setForm] = React.useState<AiEmployeeForm>(EMPTY_FORM);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextItems, nextPackages, nextDepartments] = await Promise.all([
        knowledgeApi.listAiEmployees(),
        knowledgeApi.listPositionPackages(),
        adminService.listDepartments(),
      ]);
      setItems(nextItems);
      setPackages(nextPackages);
      setDepartments(nextDepartments);
      setForm((current) => (current.departmentId || !nextDepartments[0] ? current : { ...current, departmentId: nextDepartments[0].id }));
    } catch (error) {
      toast.pushToast({ title: 'AI 员工配置加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setForm({ ...EMPTY_FORM, departmentId: departments[0]?.id ?? EMPTY_FORM.departmentId });
  };

  const startEdit = async (item: AiEmployee) => {
    try {
      const detail = await knowledgeApi.getAiEmployee(item.id);
      setForm({
        id: detail.id,
        code: detail.code,
        name: detail.name,
        description: detail.description ?? '',
        positionCode: detail.positionCode ?? 'product_manager',
        departmentId: detail.departmentId ?? departments[0]?.id ?? '2',
        enabled: detail.enabled,
        packageIds: (detail.packages ?? []).map((pkg) => pkg.id),
      });
    } catch (error) {
      toast.pushToast({ title: '读取 AI 员工失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
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
      toast.pushToast({ title: '请输入编码和名称', tone: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        positionCode: form.positionCode.trim(),
        departmentId: form.departmentId,
        enabled: form.enabled,
      };
      const saved = form.id
        ? await knowledgeApi.updateAiEmployee(form.id, payload)
        : await knowledgeApi.createAiEmployee(payload);
      await knowledgeApi.updateAiEmployeePackages(saved.id, form.packageIds);
      toast.pushToast({ title: form.id ? 'AI 员工配置已更新' : 'AI 员工已创建', tone: 'success' });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">AI 员工配置</h1>
          <p className="text-sm text-slate-500">在硅基猿猴俱乐部管理台维护 AI 员工身份、部门、岗位和岗位知识绑定。</p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
          <RefreshCw size={16} />
          刷新
        </button>
      </div>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{form.id ? '编辑 AI 员工' : '创建 AI 员工'}</h2>
          <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-bold text-blue-700">
            <Plus size={15} />
            新建
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="编码，如 ai_pm_002" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="名称" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
          <input value={form.positionCode} onChange={(event) => setForm({ ...form, positionCode: event.target.value })} placeholder="岗位编码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
          <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none">
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </div>

        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="职责说明、可处理任务和边界" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
            启用
          </label>
          <button onClick={() => void save()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <Save size={16} />
            {isSaving ? '保存中' : '保存配置'}
          </button>
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
          {packages.length === 0 ? <p className="text-sm text-slate-500">暂无岗位知识，请先在岗位知识管理页面创建并审核通过。</p> : null}
        </div>
      </section>

      <section className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {isLoading ? <div className="p-8 text-center text-sm text-slate-500">加载中...</div> : null}
        {!isLoading && items.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">暂无 AI 员工</div> : null}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {item.code} · 部门 {item.departmentId || '未配置'} · {item.positionCode || '未绑定岗位'} · {item.status} · {item.enabled ? '启用' : '停用'}
              </p>
            </div>
            <button onClick={() => void startEdit(item)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-700">配置</button>
          </div>
        ))}
      </section>
    </div>
  );
}
