import React, { useEffect, useState } from 'react';
import { Cpu, File, RefreshCw, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Document, ParseEngine } from '../types';
import { documentRepository } from '../services';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { getErrorMessage } from '../lib/errors';
import { getFileExtension } from '../lib/documentFormats';

interface ReparseModalProps {
  document: Document;
  onClose: () => void;
  onConfirm: (updatedDocument: Document) => void;
}

export function ReparseModal({ document, onClose, onConfirm }: ReparseModalProps) {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [engines, setEngines] = useState<ParseEngine[]>([]);
  const [selectedEngineCode, setSelectedEngineCode] = useState('');
  const [isLoadingEngines, setIsLoadingEngines] = useState(true);
  const [engineLoadError, setEngineLoadError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  if (!currentUser) {
    return null;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadParseEngines() {
      setIsLoadingEngines(true);
      setEngineLoadError(null);

      try {
        const availableEngines = await documentRepository.listParseEngines(document.latestSourceFile);
        if (cancelled) {
          return;
        }

        setEngines(availableEngines);
        if (!availableEngines.length) {
          setSelectedEngineCode('');
          setEngineLoadError(
            getFileExtension(document.latestSourceFile) === 'pptx'
              ? 'PPTX 当前仅支持在线预览，不支持在线解析。'
              : '当前文件类型未配置解析引擎。'
          );
          return;
        }

        const matchedCurrentEngine = availableEngines.find((engine) => engine.name === document.parseJob.engine);
        const defaultEngine = availableEngines.find((engine) => engine.isDefault) ?? availableEngines[0];
        setSelectedEngineCode(matchedCurrentEngine?.code ?? defaultEngine?.code ?? '');
      } catch (caughtError) {
        if (cancelled) {
          return;
        }
        setEngineLoadError(getErrorMessage(caughtError, '解析引擎加载失败'));
      } finally {
        if (!cancelled) {
          setIsLoadingEngines(false);
        }
      }
    }

    void loadParseEngines();

    return () => {
      cancelled = true;
    };
  }, [document.latestSourceFile, document.parseJob.engine]);

  const handleConfirm = async () => {
    if (!selectedEngineCode) {
      return;
    }

    setIsParsing(true);

    try {
      const updated = await documentRepository.startParse(document.id, {
        engine: selectedEngineCode,
        operator: currentUser,
      });
      pushToast({
        tone: 'success',
        title: '重新解析完成',
        description: '文档已生成新版本，等待生成 LLM Wiki 并同步 RAG。',
      });
      onConfirm(updated);
      onClose();
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '重新解析失败',
        description: getErrorMessage(caughtError, '重新解析失败'),
      });
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
              <RefreshCw size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">重新解析文档</h2>
              <p className="text-sm text-slate-500">固定使用当前原文件，并按文件类型从后端获取可选解析引擎。</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-8">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">当前原文件</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <File size={18} className="text-slate-400" />
              <span>{document.latestSourceFile}</span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">选择解析引擎</label>
            <div className="relative">
              <Cpu className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                value={selectedEngineCode}
                onChange={(event) => setSelectedEngineCode(event.target.value)}
                disabled={isLoadingEngines || Boolean(engineLoadError)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                {engines.map((engine) => (
                  <option key={engine.code} value={engine.code}>
                    {engine.name}
                    {engine.isDefault ? '（默认）' : ''}
                  </option>
                ))}
              </select>
            </div>
            {isLoadingEngines ? <p className="mt-2 text-xs text-slate-400">正在加载可用解析引擎...</p> : null}
            {engineLoadError ? <p className="mt-2 text-xs text-rose-600">{engineLoadError}</p> : null}
            {!isLoadingEngines && !engineLoadError && selectedEngineCode ? (
              <p className="mt-2 text-xs text-slate-500">
                {engines.find((engine) => engine.code === selectedEngineCode)?.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-8 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-200">
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isParsing || isLoadingEngines || Boolean(engineLoadError) || !selectedEngineCode}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isParsing ? <RefreshCw size={18} className="animate-spin" /> : null}
            {isParsing ? '解析中...' : '开始解析'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
