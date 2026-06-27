/**
 * 解析校正弹窗，负责展示原始信息、版本历史和 Markdown 校正内容。
 */
import React, { useEffect, useState } from 'react';
import { FileText, History, RefreshCw, Save, ScrollText, X } from 'lucide-react';
import { motion } from 'motion/react';
import { AuditRecord, Document, DocumentVersion, Folder } from '../types';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { documentRepository } from '../services';
import { formatDateTime } from '../lib/format';
import { isDocumentReadOnly } from '../lib/permissions';
import { getErrorMessage } from '../lib/errors';
import { ReparseModal } from './ReparseModal';
import { ParseArtifactsModal } from './ParseArtifactsModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { AuditTrailModal } from './AuditTrailModal';
import { MarkdownEditor } from './markdown/MarkdownEditor';

interface ParsingModalProps {
  document: Document;
  folders: Folder[];
  onClose: () => void;
  onUpdate: (document: Document) => void;
}

export function ParsingModal({ document, folders, onClose, onUpdate }: ParsingModalProps) {
  const { currentUser } = useUser();
  const { pushToast } = useToast();
  const [showReparseModal, setShowReparseModal] = useState(false);
  const [showArtifactsModal, setShowArtifactsModal] = useState(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [showAuditTrailModal, setShowAuditTrailModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(document.currentVersion);
  const [versions, setVersions] = useState<DocumentVersion[]>(document.versionHistory);
  const [audits, setAudits] = useState<AuditRecord[]>(document.auditTrail);
  const [editedName, setEditedName] = useState(document.name);
  const [editedDescription, setEditedDescription] = useState(document.description);
  const [editedTags, setEditedTags] = useState(document.tags.join(', '));
  const [editedContent, setEditedContent] = useState(document.latestParsedText);
  const [isSaving, setIsSaving] = useState(false);

  const readOnly = isDocumentReadOnly(document, currentUser, folders);

  useEffect(() => {
    setEditedName(document.name);
    setEditedDescription(document.description);
    setEditedTags(document.tags.join(', '));
    setEditedContent(document.latestParsedText);
    setSelectedVersion(document.currentVersion);
  }, [document]);

  useEffect(() => {
    async function fetchHistory() {
      const history = await documentRepository.listHistory(document.id);
      setVersions(history.versions);
      setAudits(history.audits);
    }

    void fetchHistory();
  }, [document.id, document.updatedAt]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const updated = await documentRepository.saveCorrection(document.id, {
        name: editedName,
        description: editedDescription,
        tags: editedTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        latestParsedText: editedContent,
        operator: currentUser,
      });
      const history = await documentRepository.listHistory(document.id);
      setVersions(history.versions);
      setAudits(history.audits);
      onUpdate(updated);
      pushToast({
        tone: 'success',
        title: '校正内容已保存',
        description: '你可以继续重解析，或者直接提交审核。',
      });
    } catch (caughtError) {
      pushToast({
        tone: 'error',
        title: '保存失败',
        description: getErrorMessage(caughtError, '保存失败'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-[95vh] w-[95vw] max-w-none flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">解析与人工校正</h2>
              <p className="text-sm text-slate-500">{document.name} · V{selectedVersion}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <div className="custom-scrollbar flex-1 overflow-y-auto p-8">
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-100 bg-slate-50/40 p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <p className="text-sm font-black text-slate-900">最新解析结果</p>
                  <div className="text-xs text-slate-500">
                    <span>原始文件：{document.latestSourceFile}</span>
                    <span className="mx-2">·</span>
                    <span>解析状态：{document.parseJob.status}</span>
                    <span className="mx-2">·</span>
                    <span>更新时间：{formatDateTime(document.updatedAt)}</span>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Field label="文档标题">
                    <input
                      value={editedName}
                      onChange={(event) => setEditedName(event.target.value)}
                      disabled={readOnly}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                    />
                  </Field>
                  <Field label="文档简介">
                    <input
                      value={editedDescription}
                      onChange={(event) => setEditedDescription(event.target.value)}
                      disabled={readOnly}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                    />
                  </Field>
                  <Field label="标签（逗号分隔）">
                    <input
                      value={editedTags}
                      onChange={(event) => setEditedTags(event.target.value)}
                      disabled={readOnly}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                    />
                  </Field>
                </div>

                {document.rejectedReason ? (
                  <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    驳回原因：{document.rejectedReason}
                  </p>
                ) : null}
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-4">
                  <p className="text-sm font-black text-slate-900">解析内容（Markdown）</p>
                </div>
                <div className="h-[58vh] min-h-[420px] min-w-0">
                  <MarkdownEditor
                    value={editedContent}
                    onChange={setEditedContent}
                    readOnly={readOnly}
                    defaultMode="preview"
                  />
                </div>
              </section>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-8 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowArtifactsModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <FileText size={16} />
                查看中间产物
              </button>
              <button
                onClick={() => setShowVersionHistoryModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <History size={16} />
                历史版本
              </button>
              <button
                onClick={() => setShowAuditTrailModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <ScrollText size={16} />
                审计记录
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!readOnly ? (
                <button
                  onClick={() => setShowReparseModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  <RefreshCw size={16} />
                  重新解析
                </button>
              ) : null}
              {!readOnly ? (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 font-bold text-white shadow-lg shadow-blue-700/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />
                  {isSaving ? '保存中...' : '保存修改'}
                </button>
              ) : null}
              <button onClick={onClose} className="rounded-xl bg-white px-5 py-2.5 font-bold text-slate-600 transition hover:bg-slate-100">
                关闭
              </button>
            </div>
          </div>
        </div>

        {showReparseModal ? (
          <ReparseModal
            document={document}
            onClose={() => setShowReparseModal(false)}
            onConfirm={(updatedDocument) => {
              onUpdate(updatedDocument);
              setEditedContent(updatedDocument.latestParsedText);
              setSelectedVersion(updatedDocument.currentVersion);
            }}
          />
        ) : null}

        {showArtifactsModal ? (
          <ParseArtifactsModal
            document={document}
            version={selectedVersion}
            onClose={() => setShowArtifactsModal(false)}
          />
        ) : null}

        {showVersionHistoryModal ? (
          <VersionHistoryModal
            document={document}
            versions={versions}
            selectedVersion={selectedVersion}
            onSelectVersion={(version) => {
              setSelectedVersion(version.version);
              setEditedContent(version.parsedContent);
            }}
            onClose={() => setShowVersionHistoryModal(false)}
          />
        ) : null}

        {showAuditTrailModal ? (
          <AuditTrailModal
            document={document}
            audits={audits}
            onClose={() => setShowAuditTrailModal(false)}
          />
        ) : null}
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}
