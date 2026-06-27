import React from 'react';
import { Plus, Users } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { AiEmployee } from '../../types';
import { useToast } from '../../contexts/ToastContext';

export function AiEmployees() {
  const toast = useToast();
  const [items, setItems] = React.useState<AiEmployee[]>([]);
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [positionCode, setPositionCode] = React.useState('product_manager');

  const load = React.useCallback(async () => {
    try {
      setItems(await knowledgeApi.listAiEmployees());
    } catch (error) {
      toast.pushToast({ title: 'AI 员工加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!code || !name) {
      toast.pushToast({ title: '请输入编码和名称', tone: 'error' });
      return;
    }
    try {
      await knowledgeApi.createAiEmployee({ code, name, positionCode, departmentId: '1', enabled: true });
      setCode('');
      setName('');
      toast.pushToast({ title: 'AI 员工已创建', tone: 'success' });
      await load();
    } catch (error) {
      toast.pushToast({ title: '创建失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">AI 员工</h1>
        <p className="text-sm text-slate-500">管理 AI 员工身份、岗位与知识访问边界。</p>
      </div>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[1fr_1fr_220px_auto]">
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="编码，如 ai_pm_002" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="名称" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
        <input value={positionCode} onChange={(event) => setPositionCode(event.target.value)} placeholder="岗位编码" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
        <button onClick={() => void create()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} />
          创建
        </button>
      </section>

      <section className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <p className="text-sm font-bold text-slate-900">{item.name}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.code} · {item.positionCode || '未绑定岗位'} · {item.status} · {item.enabled ? '启用' : '停用'}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
