import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2 } from 'lucide-react';
import { getAuthToken } from '../../lib/authStorage';

const env = import.meta.env as Record<string, string | undefined>;
const API_BASE_URL = env.VITE_API_BASE_URL ?? 'http://localhost:8080';

interface MarkdownContentProps {
  content: string;
  className?: string;
  articleClassName?: string;
  emptyMessage?: string;
}

function resolveAssetUrl(src: string) {
  if (src.startsWith('/api/')) {
    return `${API_BASE_URL}${src}`;
  }
  return src;
}

function needsAuthFetch(src: string) {
  return src.startsWith('/api/') || src.startsWith(`${API_BASE_URL}/api/`);
}

function AuthenticatedMarkdownImage({
  src,
  alt,
}: {
  src?: string;
  alt?: string;
}) {
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let revokeUrl: string | null = null;

    async function loadImage() {
      if (!src) {
        setResolvedSrc('');
        setLoading(false);
        return;
      }

      const normalizedUrl = resolveAssetUrl(src);
      if (!needsAuthFetch(src)) {
        setResolvedSrc(normalizedUrl);
        setLoading(false);
        return;
      }

      try {
        const headers = new Headers();
        const token = getAuthToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        const response = await fetch(normalizedUrl, { headers });
        if (!response.ok) {
          throw new Error(`加载失败(${response.status})`);
        }
        const blob = await response.blob();
        if (cancelled) {
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        revokeUrl = objectUrl;
        setResolvedSrc(objectUrl);
      } catch (caughtError) {
        if (!cancelled) {
          const message = caughtError instanceof Error ? caughtError.message : '加载失败';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setError(null);
    setResolvedSrc('');
    void loadImage();
    return () => {
      cancelled = true;
      if (revokeUrl) {
        URL.revokeObjectURL(revokeUrl);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
        <Loader2 size={14} className="animate-spin" />
        加载图片中...
      </span>
    );
  }

  if (error) {
    return <span className="text-xs text-rose-600">图片加载失败：{error}</span>;
  }

  if (!resolvedSrc) {
    return <span className="text-xs text-slate-400">（图片地址为空）</span>;
  }

  return <img src={resolvedSrc} alt={alt ?? ''} className="my-4 max-w-full rounded-xl border border-slate-200 bg-white" />;
}

export function MarkdownContent({
  content,
  className,
  articleClassName,
  emptyMessage = '（暂无内容）',
}: MarkdownContentProps) {
  const renderedContent = useMemo(() => (content && content.trim() ? content : emptyMessage), [content, emptyMessage]);

  return (
    <div className={className ?? 'custom-scrollbar h-full overflow-auto bg-slate-50/60 p-8'}>
      <article className={articleClassName ?? 'mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-sm'}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ node: _node, ...props }) => <h1 className="mb-6 text-3xl font-black text-slate-900" {...props} />,
            h2: ({ node: _node, ...props }) => <h2 className="mb-4 mt-8 text-2xl font-bold text-slate-900" {...props} />,
            h3: ({ node: _node, ...props }) => <h3 className="mb-3 mt-6 text-xl font-bold text-slate-900" {...props} />,
            p: ({ node: _node, ...props }) => <p className="mb-4 leading-7 text-slate-700" {...props} />,
            ul: ({ node: _node, ...props }) => <ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700" {...props} />,
            ol: ({ node: _node, ...props }) => <ol className="mb-4 list-decimal space-y-2 pl-6 text-slate-700" {...props} />,
            li: ({ node: _node, ...props }) => <li className="leading-7" {...props} />,
            blockquote: ({ node: _node, ...props }) => (
              <blockquote className="mb-4 rounded-r-2xl border-l-4 border-blue-300 bg-blue-50 px-4 py-3 text-slate-700" {...props} />
            ),
            pre: ({ node: _node, ...props }) => (
              <pre className="mb-4 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-4 text-sm text-slate-100" {...props} />
            ),
            code: ({ node: _node, className: codeClassName, children, ...props }) => (
              <code className={`rounded bg-slate-100 px-1.5 py-0.5 text-sm text-blue-700 ${codeClassName ?? ''}`} {...props}>
                {children}
              </code>
            ),
            a: ({ node: _node, ...props }) => <a className="text-blue-700 underline decoration-blue-200 underline-offset-4" {...props} />,
            table: ({ node: _node, ...props }) => (
              <div className="mb-4 overflow-x-auto">
                <table className="min-w-full border-collapse overflow-hidden rounded-2xl border border-slate-200" {...props} />
              </div>
            ),
            th: ({ node: _node, ...props }) => <th className="border border-slate-200 bg-slate-100 px-3 py-2 text-left text-sm font-bold text-slate-700" {...props} />,
            td: ({ node: _node, ...props }) => <td className="border border-slate-200 px-3 py-2 text-sm text-slate-700" {...props} />,
            img: ({ node: _node, src, alt }) => <AuthenticatedMarkdownImage src={src} alt={alt} />,
          }}
        >
          {renderedContent}
        </ReactMarkdown>
      </article>
    </div>
  );
}
