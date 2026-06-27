import React from 'react';
import { Archive, Briefcase, CheckCircle2, Plus, Save, Send, Trash2, XCircle } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { PositionPackage, WikiPage } from '../../types';
import { useToast } from '../../contexts/ToastContext';

const emptyForm = {
  id: '',
  code: '',
  name: '',
  positionCode: 'product_manager',
  description: '',
};

export function PositionPackages() {
  const toast = useToast();
  const [items, setItems] = React.useState<PositionPackage[]>([]);
  const [wikiPages, setWikiPages] = React.useState<WikiPage[]>([]);
  const [form, setForm] = React.useState(emptyForm);
  const [selectedWikiIds, setSelectedWikiIds] = React.useState<string[]>([]);
  const [requiredWikiIds, setRequiredWikiIds] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextItems, nextWikiPages] = await Promise.all([
        knowledgeApi.listPositionPackages(),
        knowledgeApi.listWikiPages(),
      ]);
      setItems(nextItems);
      setWikiPages(nextWikiPages);
    } catch (error) {
      toast.pushToast({ title: '岗位知识管理加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const edit = async (item: PositionPackage) => {
    try {
      const detail = await knowledgeApi.getPositionPackage(item.id);
      setForm({
        id: detail.id,
        code: detail.code,
        name: detail.name,
        positionCode: detail.positionCode || 'product_manager',
        description: detail.description || '',
      });
      const wikiIds = (detail.items ?? []).filter((entry) => entry.itemType === 'wiki_page').map((entry) => entry.itemId);
      setSelectedWikiIds(wikiIds);
      setRequiredWikiIds((detail.items ?? []).filter((entry) => entry.itemType === 'wiki_page' && entry.required).map((entry) => entry.itemId));
    } catch (error) {
      toast.pushToast({ title: '读取岗位知识失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.pushToast({ title: '请输入编码和名称', tone: 'error' });
      return;
    }
    try {
      const payload = {
        code: form.code,
        name: form.name,
        positionCode: form.positionCode,
        description: form.description,
      };
      const saved = form.id
        ? await knowledgeApi.updatePositionPackage(form.id, payload)
        : await knowledgeApi.createPositionPackage(payload);
      const targetId = form.id || saved.id;
      await knowledgeApi.replacePositionPackageItems(targetId, selectedWikiIds.map((id, index) => ({
        itemType: 'wiki_page',
        itemId: id,
        required: requiredWikiIds.includes(id),
        sortOrder: (index + 1) * 10,
      })));
      toast.pushToast({ title: '岗位知识已保存', tone: 'success' });
      setForm(emptyForm);
      setSelectedWikiIds([]);
      setRequiredWikiIds([]);
      await load();
    } catch (error) {
      toast.pushToast({ title: '保存失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const statusAction = async (item: PositionPackage, action: 'submit' | 'approve' | 'reject' | 'archive' | 'delete') => {
    try {
      if (action === 'submit') {
        await knowledgeApi.submitPositionPackageReview(item.id);
      } else if (action === 'approve') {
        await knowledgeApi.publishPositionPackage(item.id);
      } else if (action === 'reject') {
        await knowledgeApi.rejectPositionPackage(item.id);
      } else if (action === 'archive') {
        await knowledgeApi.archivePositionPackage(item.id);
      } else {
        await knowledgeApi.deletePositionPackage(item.id);
      }
      toast.pushToast({ title: '岗位知识状态已更新', tone: 'success' });
      if (form.id === item.id) {
        setForm(emptyForm);
        setSelectedWikiIds([]);
        setRequiredWikiIds([]);
      }
      await load();
    } catch (error) {
      toast.pushToast({ title: '状态更新失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const toggleWiki = (id: string) => {
    setSelectedWikiIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleRequired = (id: string) => {
    setRequiredWikiIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">岗位知识管理</h1>
          <p className="text-sm text-slate-500">岗位知识以 Wiki 页面为源头，负责维护岗位默认知识范围、必读页面、审核发布状态，并供 AI 员工绑定使用。</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setSelectedWikiIds([]); setRequiredWikiIds([]); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} />
          新建岗位知识
        </button>
      </div>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_180px]">
          <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="编码，如 pkg_architect" className={inputClass} />
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="名称" className={inputClass} />
          <input value={form.positionCode} onChange={(event) => setForm((current) => ({ ...current, positionCode: event.target.value }))} placeholder="岗位编码" className={inputClass} />
        </div>
        <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="岗位知识说明、适用边界、审核备注" className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">选择 Wiki 页面</p>
            <p className="mt-1 text-xs text-slate-500">勾选后写入 `ks_position_package_item`，AI 员工加载岗位知识时以这些 Wiki 页面作为默认知识范围。</p>
          </div>
          <div className="grid max-h-80 gap-2 overflow-y-auto p-4 md:grid-cols-2">
            {wikiPages.length === 0 ? <p className="text-sm text-slate-500">暂无 Wiki 页面，请先在 Wiki 中心创建。</p> : null}
            {wikiPages.map((page) => {
              const selected = selectedWikiIds.includes(page.id);
              return (
                <div key={page.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={selected} onChange={() => toggleWiki(page.id)} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{page.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">{page.status} · RAG {page.syncStatus} · V{page.currentVersion}</span>
                    </span>
                  </label>
                  {selected ? (
                    <label className="mt-3 flex items-center gap-2 pl-7 text-xs font-bold text-slate-600">
                      <input type="checkbox" checked={requiredWikiIds.includes(page.id)} onChange={() => toggleRequired(page.id)} className="h-4 w-4 rounded border-slate-300 text-blue-700" />
                      必读 Wiki
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {form.id ? <button onClick={() => { setForm(emptyForm); setSelectedWikiIds([]); setRequiredWikiIds([]); }} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">取消编辑</button> : null}
          <button onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            <Save size={16} />
            保存岗位知识
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <h2 className="font-bold text-slate-900">岗位知识列表</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? <div className="p-8 text-center text-sm text-slate-500">加载中...</div> : null}
          {!isLoading && items.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">暂无岗位知识。</div> : null}
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_auto]">
              <button onClick={() => void edit(item)} className="min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <Briefcase size={16} className="text-blue-600" />
                  <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{item.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.code} · 岗位 {item.positionCode || '未绑定'} · Wiki {item.itemCount ?? item.items?.length ?? 0}</p>
                {item.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{item.description}</p> : null}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => void statusAction(item, 'submit')} className={actionButtonClass}>
                  <Send size={14} />
                  提交审核
                </button>
                <button onClick={() => void statusAction(item, 'approve')} className={actionButtonClass}>
                  <CheckCircle2 size={14} />
                  审核通过
                </button>
                <button onClick={() => void statusAction(item, 'reject')} className={actionButtonClass}>
                  <XCircle size={14} />
                  驳回
                </button>
                <button onClick={() => void statusAction(item, 'archive')} className={actionButtonClass}>
                  <Archive size={14} />
                  归档
                </button>
                <button onClick={() => void statusAction(item, 'delete')} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600">
                  <Trash2 size={14} />
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const inputClass = 'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100';
const actionButtonClass = 'inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700';
