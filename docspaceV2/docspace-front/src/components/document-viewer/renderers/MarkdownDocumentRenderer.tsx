import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DocumentRendererProps } from '../types';
import { MarkdownContent } from '../../markdown/MarkdownContent';

export function MarkdownDocumentRenderer({ source }: DocumentRendererProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMarkdown() {
      setLoading(true);
      setError(null);
      try {
        const text = await source.blob.text();
        if (!cancelled) {
          setContent(text);
        }
      } catch {
        if (!cancelled) {
          setError('Markdown 原文读取失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMarkdown();
    return () => {
      cancelled = true;
    };
  }, [source.blob]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        <Loader2 size={18} className="mr-2 animate-spin" />
        正在解析 Markdown...
      </div>
    );
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-rose-600">{error}</div>;
  }

  return <MarkdownContent content={content} />;
}
