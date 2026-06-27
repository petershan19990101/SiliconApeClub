import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import { MarkdownContent } from './MarkdownContent';

type EditorMode = 'preview' | 'source';

interface MarkdownEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  readOnly?: boolean;
  defaultMode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void;
}

interface SelectionContext {
  value: string;
  start: number;
  end: number;
  selected: string;
  before: string;
  after: string;
}

interface EditResult {
  nextValue: string;
  selectionStart: number;
  selectionEnd: number;
}

interface ToolbarButtonProps {
  label: string;
  title: string;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}

interface SelectionRange {
  start: number;
  end: number;
}

interface NoticeState {
  tone: 'success' | 'error' | 'info';
  message: string;
}

function ToolbarButton({
  label,
  title,
  disabled = false,
  active = false,
  danger = false,
  onClick,
}: ToolbarButtonProps) {
  const toneClass = danger
    ? 'border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50'
    : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50';

  const activeClass = active
    ? 'border-blue-300 bg-blue-50 text-blue-700'
    : 'bg-white';

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-bold leading-4 transition ${toneClass} ${activeClass} disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {label}
    </button>
  );
}

function findAllOccurrences(source: string, target: string): number[] {
  if (!target) {
    return [];
  }

  const positions: number[] = [];
  let fromIndex = 0;

  while (fromIndex <= source.length) {
    const next = source.indexOf(target, fromIndex);
    if (next === -1) {
      break;
    }
    positions.push(next);
    fromIndex = next + Math.max(target.length, 1);
  }

  return positions;
}

export function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  defaultMode = 'preview',
  onModeChange,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const pendingSourceActionRef = useRef<(() => void) | null>(null);
  const lastSelectionRef = useRef<SelectionRange | null>(null);
  const currentValueRef = useRef(value);
  const noticeTimerRef = useRef<number | null>(null);

  const [mode, setMode] = useState<EditorMode>(readOnly ? 'preview' : defaultMode);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const deferredValue = useDeferredValue(value);

  useEffect(() => {
    currentValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (readOnly && mode !== 'preview') {
      setMode('preview');
    }
  }, [mode, readOnly]);

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current != null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== 'source' || !pendingSourceActionRef.current || !textareaRef.current) {
      return;
    }

    const action = pendingSourceActionRef.current;
    pendingSourceActionRef.current = null;
    action();
  }, [mode, value]);

  const pushNotice = (tone: NoticeState['tone'], message: string) => {
    setNotice({ tone, message });
    if (noticeTimerRef.current != null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 2800);
  };

  const syncSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    lastSelectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  };

  const applyEdit = (builder: (context: SelectionContext) => EditResult) => {
    if (readOnly) {
      return;
    }

    const execute = () => {
      const textarea = textareaRef.current;
      if (!textarea) {
        pendingSourceActionRef.current = execute;
        return;
      }

      const source = currentValueRef.current;
      let start = textarea.selectionStart;
      let end = textarea.selectionEnd;
      const hasFocus = document.activeElement === textarea;

      if (!hasFocus) {
        if (lastSelectionRef.current) {
          start = lastSelectionRef.current.start;
          end = lastSelectionRef.current.end;
        } else {
          start = source.length;
          end = source.length;
        }
      }

      if (start > end) {
        [start, end] = [end, start];
      }

      const selected = source.slice(start, end);
      const before = source.slice(0, start);
      const after = source.slice(end);

      const result = builder({
        value: source,
        start,
        end,
        selected,
        before,
        after,
      });

      onChange(result.nextValue);
      lastSelectionRef.current = {
        start: result.selectionStart,
        end: result.selectionEnd,
      };

      requestAnimationFrame(() => {
        const editor = textareaRef.current;
        if (!editor) {
          return;
        }

        editor.focus();

        const max = result.nextValue.length;
        const safeStart = Math.min(Math.max(result.selectionStart, 0), max);
        const safeEnd = Math.min(Math.max(result.selectionEnd, safeStart), max);

        editor.setSelectionRange(safeStart, safeEnd);
        lastSelectionRef.current = {
          start: safeStart,
          end: safeEnd,
        };
      });
    };

    if (mode !== 'source') {
      pendingSourceActionRef.current = execute;
      setMode('source');
      return;
    }

    execute();
  };

  const applyInlineWrap = (
    leftWrapper: string,
    rightWrapper: string,
    placeholder: string
  ) => {
    applyEdit(({ start, end, selected, before, after }) => {
      const hasSelection = selected.length > 0;
      const body = hasSelection ? selected : placeholder;
      const nextValue = `${before}${leftWrapper}${body}${rightWrapper}${after}`;
      const selectionStart = start + leftWrapper.length;
      const selectionEnd = hasSelection ? end + leftWrapper.length : selectionStart + placeholder.length;

      return {
        nextValue,
        selectionStart,
        selectionEnd,
      };
    });
  };

  const applyLineTransform = (
    transformLine: (line: string, lineIndex: number) => string
  ) => {
    applyEdit(({ value: fullValue, start, end }) => {
      const blockStart = fullValue.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const blockEndRaw = fullValue.indexOf('\n', end);
      const blockEnd = blockEndRaw === -1 ? fullValue.length : blockEndRaw;
      const block = fullValue.slice(blockStart, blockEnd);
      const lines = block.split('\n');
      const transformed = lines.map((line, index) => transformLine(line, index)).join('\n');
      const nextValue = `${fullValue.slice(0, blockStart)}${transformed}${fullValue.slice(blockEnd)}`;

      return {
        nextValue,
        selectionStart: blockStart,
        selectionEnd: blockStart + transformed.length,
      };
    });
  };

  const insertTemplate = (
    template: string,
    selectionStartOffset?: number,
    selectionEndOffset?: number
  ) => {
    applyEdit(({ start, before, after }) => {
      const nextValue = `${before}${template}${after}`;
      const selectionStart = selectionStartOffset == null
        ? start + template.length
        : start + selectionStartOffset;
      const selectionEnd = selectionEndOffset == null
        ? selectionStart
        : start + selectionEndOffset;

      return {
        nextValue,
        selectionStart,
        selectionEnd,
      };
    });
  };

  const insertDivider = () => {
    applyEdit(({ start, before, after, value: fullValue }) => {
      const needsLeadingLine = start > 0 && fullValue[start - 1] !== '\n';
      const needsTrailingLine = start < fullValue.length && fullValue[start] !== '\n';
      const prefix = needsLeadingLine ? '\n' : '';
      const suffix = needsTrailingLine ? '\n' : '';
      const divider = `${prefix}\n---\n${suffix}`;
      const nextValue = `${before}${divider}${after}`;
      const caret = start + divider.length;

      return {
        nextValue,
        selectionStart: caret,
        selectionEnd: caret,
      };
    });
  };

  const insertLink = () => {
    applyEdit(({ start, selected, before, after }) => {
      const label = selected || '链接文本';
      const url = 'https://example.com';
      const markdown = `[${label}](${url})`;
      const nextValue = `${before}${markdown}${after}`;

      if (selected) {
        const caret = start + markdown.length;
        return {
          nextValue,
          selectionStart: caret,
          selectionEnd: caret,
        };
      }

      const urlStart = start + label.length + 3;
      return {
        nextValue,
        selectionStart: urlStart,
        selectionEnd: urlStart + url.length,
      };
    });
  };

  const insertImage = () => {
    const template = '![图片描述](https://example.com/image.png)';
    const urlStart = template.indexOf('https://');
    insertTemplate(template, urlStart, urlStart + 'https://example.com/image.png'.length);
  };

  const insertTable = () => {
    const template = [
      '| 列1 | 列2 | 列3 |',
      '| --- | --- | --- |',
      '| 内容1 | 内容2 | 内容3 |',
    ].join('\n');
    insertTemplate(template);
  };

  const formattingDisabled = readOnly;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="custom-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-slate-100 bg-slate-50 px-3 py-2">
        <ToolbarButton
          label="预览"
          title="预览模式"
          active={mode === 'preview'}
          onClick={() => setMode('preview')}
        />
        <ToolbarButton
          label="源码"
          title={readOnly ? '只读模式不可编辑' : '切换到源码编辑'}
          active={mode === 'source'}
          disabled={readOnly}
          onClick={() => setMode('source')}
        />

        <span className="mx-1 h-4 w-px shrink-0 bg-slate-200" />

        <ToolbarButton label="H1" title="一级标题" disabled={formattingDisabled} onClick={() => applyLineTransform((line) => line.trim() ? `# ${line.replace(/^#{1,6}\s+/, '')}` : line)} />
        <ToolbarButton label="H2" title="二级标题" disabled={formattingDisabled} onClick={() => applyLineTransform((line) => line.trim() ? `## ${line.replace(/^#{1,6}\s+/, '')}` : line)} />
        <ToolbarButton label="H3" title="三级标题" disabled={formattingDisabled} onClick={() => applyLineTransform((line) => line.trim() ? `### ${line.replace(/^#{1,6}\s+/, '')}` : line)} />

        <span className="mx-1 h-4 w-px shrink-0 bg-slate-200" />

        <ToolbarButton label="粗体" title="粗体" disabled={formattingDisabled} onClick={() => applyInlineWrap('**', '**', '粗体文本')} />
        <ToolbarButton label="斜体" title="斜体" disabled={formattingDisabled} onClick={() => applyInlineWrap('*', '*', '斜体文本')} />
        <ToolbarButton label="删除线" title="删除线" disabled={formattingDisabled} onClick={() => applyInlineWrap('~~', '~~', '删除线文本')} />
        <ToolbarButton label="行内代码" title="行内代码" disabled={formattingDisabled} onClick={() => applyInlineWrap('`', '`', 'code')} />

        <span className="mx-1 h-4 w-px shrink-0 bg-slate-200" />

        <ToolbarButton label="引用" title="引用" disabled={formattingDisabled} onClick={() => applyLineTransform((line) => line.trim() ? `> ${line.replace(/^>\s+/, '')}` : line)} />
        <ToolbarButton label="无序列表" title="无序列表" disabled={formattingDisabled} onClick={() => applyLineTransform((line) => line.trim() ? `- ${line.replace(/^[-*]\s+/, '')}` : line)} />
        <ToolbarButton label="有序列表" title="有序列表" disabled={formattingDisabled} onClick={() => {
          let order = 1;
          applyLineTransform((line) => {
            if (!line.trim()) {
              return line;
            }
            const next = `${order}. ${line.replace(/^\d+\.\s+/, '')}`;
            order += 1;
            return next;
          });
        }} />
        <ToolbarButton label="任务列表" title="任务列表" disabled={formattingDisabled} onClick={() => applyLineTransform((line) => line.trim() ? `- [ ] ${line.replace(/^[-*]\s+\[[ xX]\]\s+/, '')}` : line)} />
        <ToolbarButton label="代码块" title="代码块" disabled={formattingDisabled} onClick={() => applyInlineWrap('```\n', '\n```', 'code block')} />
        <ToolbarButton label="分割线" title="分割线" disabled={formattingDisabled} onClick={insertDivider} />

        <span className="mx-1 h-4 w-px shrink-0 bg-slate-200" />

        <ToolbarButton label="链接" title="链接" disabled={formattingDisabled} onClick={insertLink} />
        <ToolbarButton label="图片" title="图片" disabled={formattingDisabled} onClick={insertImage} />
        <ToolbarButton label="表格" title="表格" disabled={formattingDisabled} onClick={insertTable} />

      </div>

      {notice ? (
        <div
          className={`border-b px-3 py-1.5 text-xs ${
            notice.tone === 'success'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : notice.tone === 'error'
                ? 'border-rose-100 bg-rose-50 text-rose-700'
                : 'border-slate-100 bg-slate-50 text-slate-600'
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 p-3">
        {mode === 'source' && !readOnly ? (
          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-500">
              源码编辑
            </div>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onSelect={syncSelection}
              onKeyUp={syncSelection}
              onClick={syncSelection}
              onFocus={syncSelection}
              spellCheck={false}
              className="custom-scrollbar min-h-0 flex-1 resize-none border-0 bg-transparent p-4 font-mono text-sm leading-6 outline-none"
            />
          </section>
        ) : (
          <section
            ref={previewRootRef}
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-500">
              实时预览
            </div>
            <div className="min-h-0 flex-1">
              <MarkdownContent
                content={deferredValue}
                className="custom-scrollbar h-full overflow-auto bg-slate-50/30 p-4"
                articleClassName="mx-auto max-w-none rounded-2xl border border-slate-200 bg-white px-6 py-6"
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
