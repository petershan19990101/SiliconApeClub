import React from 'react';
import { BookOpen, Plus, Rocket, Search } from 'lucide-react';
import { knowledgeApi } from '../../services/knowledge';
import { WikiPage } from '../../types';
import { useToast } from '../../contexts/ToastContext';

export function WikiPages() {
  const toast = useToast();
  const [pages, setPages] = React.useState<WikiPage[]>([]);
  const [query, setQuery] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setPages(await knowledgeApi.listWikiPages(query));
    } catch (error) {
      toast.pushToast({ title: '知识 Wiki 加载失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [query, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const createPage = async () => {
    if (!title.trim()) {
      toast.pushToast({ title: '请输入 Wiki 标题', tone: 'error' });
      return;
    }
    try {
      await knowledgeApi.createWikiPage({
        title,
        pageType: 'general',
        summary: title,
        content,
        departmentId: '1',
      });
      setTitle('');
      setContent('');
      toast.pushToast({ title: 'Wiki 页面已创建', tone: 'success' });
      await load();
    } catch (error) {
      toast.pushToast({ title: '创建失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  const publish = async (page: WikiPage) => {
    try {
      await knowledgeApi.publishWikiPage(page.id);
      toast.pushToast({ title: '已发布并触发 RAG 同步', tone: 'success' });
      await load();
    } catch (error) {
      toast.pushToast({ title: '发布失败', description: error instanceof Error ? error.message : undefined, tone: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">知识 Wiki</h1>
          <p className="text-sm text-slate-500">人机共读的企业知识本体，发布后自动进入 RAG Memory。</p>
        </div>
        <button onClick={createPage} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} />
          创建页面
        </button>
      </div>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="页面标题" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Markdown 知识正文" className="min-h-36 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <Search size={18} className="text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Wiki" className="flex-1 text-sm outline-none" />
          <button onClick={() => void load()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-700">搜索</button>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? <div className="p-8 text-center text-sm text-slate-500">加载中...</div> : null}
          {!isLoading && pages.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">暂无 Wiki 页面</div> : null}
          {pages.map((page) => (
            <div key={page.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-blue-600" />
                  <p className="truncate text-sm font-bold text-slate-900">{page.title}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">状态 {page.status} · RAG {page.syncStatus} · 健康 {page.healthStatus} · V{page.currentVersion}</p>
              </div>
              <button onClick={() => void publish(page)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-bold text-blue-700">
                <Rocket size={15} />
                发布同步
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
