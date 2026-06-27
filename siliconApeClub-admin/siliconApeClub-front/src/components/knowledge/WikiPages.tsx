import React from 'react';
import { Archive, BookOpen, GitBranch, Plus, Rocket, Save, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { useAppShell } from '../../contexts/AppShellContext';
import { useToast } from '../../contexts/ToastContext';
import { knowledgeApi } from '../../services/knowledge';
import { WikiPage, WikiRelation, WikiStructureGroup } from '../../types';

const RELATION_TYPES: Array<WikiRelation['relationType']> = ['references', 'depends_on', 'related_to', 'supersedes', 'duplicated_with'];

const emptyForm = {
  id: '',
  title: '',
  pageType: 'general',
  summary: '',
  content: '',
  departmentId: '1',
  aclPolicyId: '1',
};

type WikiForm = typeof emptyForm;
type GroupFilter = { departmentId?: string; pageType?: string; status?: string };

export function WikiPages() {
  const toast = useToast();
  const { setCurrentView } = useAppShell();
  const [pages, setPages] = React.useState<WikiPage[]>([]);
  const [relationCandidates, setRelationCandidates] = React.useState<WikiPage[]>([]);
  const [structure, setStructure] = React.useState<WikiStructureGroup[]>([]);
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [groupBy, setGroupBy] = React.useState('department,pageType,status');
  const [groupFilter, setGroupFilter] = React.useState<GroupFilter>({});
  const [selectedPage, setSelectedPage] = React.useState<WikiPage | null>(null);
  const [relations, setRelations] = React.useState<WikiRelation[]>([]);
  const [relationForm, setRelationForm] = React.useState({ targetPageId: '', relationType: 'related_to' as WikiRelation['relationType'] });
  const [form, setForm] = React.useState<WikiForm>(emptyForm);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const effectiveStatus = groupFilter.status ?? status;

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextStructure, nextPages, nextRelationCandidates] = await Promise.all([
        knowledgeApi.getWikiStructure(groupBy, query, status),
        knowledgeApi.listWikiPages(query, effectiveStatus, {
          departmentId: groupFilter.departmentId,
          pageType: groupFilter.pageType,
        }),
        knowledgeApi.listWikiPages('', ''),
      ]);
      setStructure(nextStructure.groups);
      setPages(nextPages);
      setRelationCandidates(nextRelationCandidates);
      setSelectedPage((current) => {
        if (current && nextPages.some((page) => page.id === current.id)) {
          return nextPages.find((page) => page.id === current.id) ?? current;
        }
        return nextPages[0] ?? null;
      });
    } catch (error) {
      toast.pushToast({ title: 'Wiki 中心加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [effectiveStatus, groupBy, groupFilter.departmentId, groupFilter.pageType, query, status, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!selectedPage) {
      setRelations([]);
      return;
    }
    void loadPageDetail(selectedPage);
  }, [selectedPage?.id]);

  const loadPageDetail = async (page: WikiPage) => {
    try {
      const [detail, nextRelations] = await Promise.all([
        knowledgeApi.getWikiPage(page.id),
        knowledgeApi.listWikiRelations(page.id),
      ]);
      setForm(toForm(detail));
      setSelectedPage(detail);
      setRelations(nextRelations);
      setRelationForm((current) => ({ ...current, targetPageId: current.targetPageId || firstRelationTarget(relationCandidates, detail.id) }));
    } catch (error) {
      toast.pushToast({ title: '读取 Wiki 详情失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const startCreate = () => {
    setSelectedPage(null);
    setRelations([]);
    setForm(emptyForm);
  };

  const savePage = async () => {
    if (!form.title.trim()) {
      toast.pushToast({ title: '请输入 Wiki 标题', tone: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: form.title,
        pageType: form.pageType,
        summary: form.summary,
        content: form.content,
        departmentId: form.departmentId,
        aclPolicyId: form.aclPolicyId,
      };
      const saved = form.id
        ? await knowledgeApi.updateWikiPage(form.id, payload)
        : await knowledgeApi.createWikiPage(payload);
      toast.pushToast({ title: form.id ? 'Wiki 页面已更新' : 'Wiki 页面已创建', tone: 'success' });
      setSelectedPage(saved);
      await load();
    } catch (error) {
      toast.pushToast({ title: '保存失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const publish = async (page: WikiPage) => {
    try {
      const saved = await knowledgeApi.publishWikiPage(page.id);
      toast.pushToast({ title: 'Wiki 已发布并同步 RAG', tone: 'success' });
      setSelectedPage(saved);
      await load();
    } catch (error) {
      toast.pushToast({ title: '发布失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const archive = async (page: WikiPage) => {
    try {
      const saved = await knowledgeApi.archiveWikiPage(page.id);
      toast.pushToast({ title: 'Wiki 已归档', tone: 'success' });
      setSelectedPage(saved);
      await load();
    } catch (error) {
      toast.pushToast({ title: '归档失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const deletePage = async (page: WikiPage) => {
    try {
      await knowledgeApi.deleteWikiPage(page.id);
      toast.pushToast({ title: 'Wiki 已删除', tone: 'success' });
      setSelectedPage(null);
      setRelations([]);
      setForm(emptyForm);
      await load();
    } catch (error) {
      toast.pushToast({ title: '删除失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const addRelation = async () => {
    if (!selectedPage || !relationForm.targetPageId) {
      toast.pushToast({ title: '请选择目标 Wiki 页面', tone: 'error' });
      return;
    }
    try {
      await knowledgeApi.createWikiRelation(selectedPage.id, relationForm);
      toast.pushToast({ title: 'Wiki 关系已创建', tone: 'success' });
      const nextRelations = await knowledgeApi.listWikiRelations(selectedPage.id);
      setRelations(nextRelations);
      await load();
    } catch (error) {
      toast.pushToast({ title: '创建关系失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const removeRelation = async (relation: WikiRelation) => {
    if (!selectedPage) {
      return;
    }
    try {
      await knowledgeApi.deleteWikiRelation(selectedPage.id, relation.id);
      toast.pushToast({ title: 'Wiki 关系已删除', tone: 'success' });
      const nextRelations = await knowledgeApi.listWikiRelations(selectedPage.id);
      setRelations(nextRelations);
      await load();
    } catch (error) {
      toast.pushToast({ title: '删除关系失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const applyGroup = (path: WikiStructureGroup[]) => {
    const nextFilter: GroupFilter = {};
    path.forEach((node) => {
      if (node.type === 'department' && /^\d+$/.test(node.value)) {
        nextFilter.departmentId = node.value;
      }
      if (node.type === 'pageType') {
        nextFilter.pageType = node.value;
      }
      if (node.type === 'status') {
        nextFilter.status = node.value;
      }
    });
    setGroupFilter(nextFilter);
  };

  const clearGroup = () => setGroupFilter({});

  const relationTargets = relationCandidates.filter((page) => page.id !== selectedPage?.id);
  const incoming = relations.filter((relation) => relation.direction === 'incoming');
  const outgoing = relations.filter((relation) => relation.direction === 'outgoing');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Wiki 中心</h1>
        </div>
        <button onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} />
          新建 Wiki
        </button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_390px]">
        <aside className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-900">结构分组</h2>
              {Object.keys(groupFilter).length ? (
                <button onClick={clearGroup} className="text-xs font-bold text-blue-700">清除</button>
              ) : null}
            </div>
            <select value={groupBy} onChange={(event) => { setGroupBy(event.target.value); setGroupFilter({}); }} className={`${inputClass} mt-3 w-full`}>
              <option value="department,pageType,status">部门 / 类型 / 状态</option>
              <option value="pageType,status">类型 / 状态</option>
            </select>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-3">
            {structure.length === 0 ? <p className="p-4 text-sm text-slate-500">暂无分组</p> : null}
            {structure.map((group) => (
              <GroupNode key={`${group.type}-${group.value}`} node={group} path={[]} active={groupFilter} onSelect={applyGroup} />
            ))}
          </div>
        </aside>

        <main className="rounded-lg border border-slate-200 bg-white">
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_160px_auto]">
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <Search size={18} className="text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Wiki 标题、摘要或正文" className="flex-1 text-sm outline-none" />
            </label>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setGroupFilter((current) => ({ ...current, status: undefined })); }} className={inputClass}>
              <option value="">全部状态</option>
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
              <option value="deleted">deleted</option>
            </select>
            <button onClick={() => void load()} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">刷新</button>
          </div>

          <div className="divide-y divide-slate-100">
            {isLoading ? <div className="p-8 text-center text-sm text-slate-500">加载中...</div> : null}
            {!isLoading && pages.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">暂无 Wiki 页面</div> : null}
            {pages.map((page) => {
              const active = selectedPage?.id === page.id;
              return (
                <button key={page.id} type="button" onClick={() => setSelectedPage(page)} className={`block w-full p-4 text-left transition ${active ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <BookOpen size={16} className="text-blue-600" />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{page.title}</span>
                    <Badge>{page.pageType}</Badge>
                    <Badge>{page.status}</Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-500 md:grid-cols-2 2xl:grid-cols-4">
                    <span>部门 {page.departmentName || page.departmentId || '-'}</span>
                    <span>RAG {page.syncStatus || '-'}</span>
                    <span>ACL {page.aclPolicyName || page.aclPolicyId || '-'}</span>
                    <span>关系 {page.relationCount ?? 0}</span>
                  </div>
                  {page.summary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{page.summary}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>V{page.currentVersion}</span>
                    <span>{page.securityLevel || 'internal'}</span>
                    <span>{page.updatedAt || '-'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-900">{form.id ? '页面详情' : '新建页面'}</h2>
              {form.id ? (
                <div className="flex gap-2">
                  <button onClick={() => void publish(form as unknown as WikiPage)} className={iconButtonClass} title="发布同步">
                    <Rocket size={15} />
                  </button>
                  <button onClick={() => void archive(form as unknown as WikiPage)} className={iconButtonClass} title="归档">
                    <Archive size={15} />
                  </button>
                  <button onClick={() => void deletePage(form as unknown as WikiPage)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600" title="删除">
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Wiki 标题" className={inputClass} />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.pageType} onChange={(event) => setForm((current) => ({ ...current, pageType: event.target.value }))} placeholder="页面类型" className={inputClass} />
                <input value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))} placeholder="部门 ID" className={inputClass} />
              </div>
              <input value={form.aclPolicyId} onChange={(event) => setForm((current) => ({ ...current, aclPolicyId: event.target.value }))} placeholder="ACL 策略 ID" className={inputClass} />
              {selectedPage ? (
                <button type="button" onClick={() => setCurrentView('rag_debug')} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-600" />
                    <span className="truncate">{selectedPage.aclPolicyName || `ACL ${selectedPage.aclPolicyId || '-'}`}</span>
                  </span>
                  <span className="text-xs text-slate-400">{selectedPage.securityLevel || 'internal'} / {selectedPage.aclBindingCount ?? 0}</span>
                </button>
              ) : null}
              <input value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="摘要" className={inputClass} />
              <textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder="Markdown 知识正文" className="min-h-36 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
              <button onClick={() => void savePage()} disabled={isSaving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                <Save size={16} />
                {form.id ? '保存修改' : '创建草稿'}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <GitBranch size={17} className="text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">知识图谱关系</h2>
            </div>
            {!selectedPage ? <p className="mt-4 text-sm text-slate-500">选择页面后显示关系。</p> : null}
            {selectedPage ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-center text-sm font-bold text-blue-900">{selectedPage.title}</div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <RelationColumn title="上游 / 入向" items={incoming} currentPageId={selectedPage.id} onRemove={removeRelation} />
                  <RelationColumn title="下游 / 出向" items={outgoing} currentPageId={selectedPage.id} onRemove={removeRelation} />
                </div>
                <div className="grid gap-2">
                  <select value={relationForm.targetPageId} onChange={(event) => setRelationForm((current) => ({ ...current, targetPageId: event.target.value }))} className={inputClass}>
                    <option value="">选择目标 Wiki</option>
                    {relationTargets.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
                  </select>
                  <select value={relationForm.relationType} onChange={(event) => setRelationForm((current) => ({ ...current, relationType: event.target.value as WikiRelation['relationType'] }))} className={inputClass}>
                    {RELATION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <button onClick={() => void addRelation()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">新增关系</button>
                </div>
              </div>
            ) : null}
          </section>
        </aside>
      </section>
    </div>
  );
}

function GroupNode({ node, path, active, onSelect }: { node: WikiStructureGroup; path: WikiStructureGroup[]; active: GroupFilter; onSelect: (path: WikiStructureGroup[]) => void }) {
  const nextPath = [...path, node];
  const selected = isGroupActive(node, active);
  return (
    <div className="mb-1">
      <button onClick={() => onSelect(nextPath)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${selected ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
        <span className="truncate">{node.label}</span>
        <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{node.count}</span>
      </button>
      {node.children?.length ? (
        <div className="ml-3 border-l border-slate-100 pl-2">
          {node.children.map((child) => (
            <GroupNode key={`${child.type}-${child.value}`} node={child} path={nextPath} active={active} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RelationColumn({ title, items, currentPageId, onRemove }: { title: string; items: WikiRelation[]; currentPageId: string; onRemove: (relation: WikiRelation) => void }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? <p className="text-xs text-slate-400">暂无关系</p> : null}
        {items.map((relation) => {
          const titleText = relation.direction === 'incoming'
            ? relation.sourceTitle || relation.sourcePageId
            : relation.targetTitle || relation.targetPageId;
          return (
            <div key={relation.id} className="rounded-lg bg-white px-3 py-2 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{titleText}</p>
                  <p className="mt-1 text-xs text-slate-500">{relation.relationType} · {relation.direction === 'incoming' ? relation.sourcePageId : currentPageId}{' -> '}{relation.direction === 'incoming' ? currentPageId : relation.targetPageId}</p>
                </div>
                <button onClick={() => onRemove(relation)} className="shrink-0 rounded bg-rose-50 p-1 text-rose-600" title="删除关系">
                  <X size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{children}</span>;
}

function toForm(page: WikiPage): WikiForm {
  return {
    id: page.id,
    title: page.title,
    pageType: page.pageType || 'general',
    summary: page.summary ?? '',
    content: page.content ?? '',
    departmentId: page.departmentId ?? '1',
    aclPolicyId: page.aclPolicyId ?? '1',
  };
}

function firstRelationTarget(pages: WikiPage[], currentPageId: string) {
  return pages.find((page) => page.id !== currentPageId)?.id ?? '';
}

function isGroupActive(node: WikiStructureGroup, active: GroupFilter) {
  if (node.type === 'department') {
    return active.departmentId === node.value;
  }
  if (node.type === 'pageType') {
    return active.pageType === node.value;
  }
  return active.status === node.value;
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100';
const iconButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700';
