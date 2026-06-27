import React from 'react';
import { Briefcase, Plus, Rocket } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { PositionPackage } from '../../types';
import { useToast } from '../../contexts/ToastContext';

export function PositionPackages() {
  const toast = useToast();
  const [items, setItems] = React.useState<PositionPackage[]>([]);
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [positionCode, setPositionCode] = React.useState('product_manager');

  const load = React.useCallback(async () => {
    try {
      setItems(await knowledgeApi.listPositionPackages());
    } catch (error) {
      toast.pushToast({ title: '岗位知识包加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
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
      await knowledgeApi.createPositionPackage({ code, name, positionCode, description: `${name} 默认知识包` });
      setCode('');
      setName('');
      toast.pushToast({ title: '岗位知识包已创建', tone: 'success' });
      await load();
    } catch (error) {
      toast.pushToast({ title: '创建失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const publish = async (item: PositionPackage) => {
    try {
      await knowledgeApi.publishPositionPackage(item.id);
      toast.pushToast({ title: '岗位知识包已发布', tone: 'success' });
      await load();
    } catch (error) {
      toast.pushToast({ title: '发布失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">岗位知识包</h1>
        <p className="text-sm text-slate-500">定义 AI 员工上岗时默认读取的知识范围和工作规则。</p>
      </div>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[1fr_1fr_220px_auto]">
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="编码，如 pkg_sales" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
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
                <Briefcase size={16} className="text-blue-600" />
                <p className="text-sm font-bold text-slate-900">{item.name}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.code} · {item.positionCode || '未绑定岗位'} · {item.status}</p>
            </div>
            <button onClick={() => void publish(item)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-bold text-blue-700">
              <Rocket size={15} />
              发布
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
