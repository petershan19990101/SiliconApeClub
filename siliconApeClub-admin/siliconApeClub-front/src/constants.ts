import { AuditAction, DocumentStatus, PermissionAction, UserRole } from './types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  member: '普通成员',
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: '查看',
  edit: '编辑',
  upload: '上传',
  delete: '删除',
  share: '分享',
  manage: '管理',
  correct: '校正',
  push_rag: '推送 RAG',
  request_audit: '提交审核',
  publish: '审核发布',
  reject: '驳回',
  create_revision: '创建修订',
  lock: '锁定版本',
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  upload: '上传文档',
  parse: '解析文档',
  save: '保存校正',
  delete: '删除文档',
  submit: '提交审核',
  publish: '审核发布',
  reject: '审核驳回',
  lock: '锁定版本',
  unlock: '解除锁定',
  reparse: '重新解析',
  rag_sync: '同步 RAG',
  create_revision: '创建修订草稿',
};

export const VERSION_STATUS_LABELS = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
} as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  admin: [
    'view',
    'edit',
    'upload',
    'delete',
    'share',
    'manage',
    'correct',
    'push_rag',
    'request_audit',
    'publish',
    'reject',
    'create_revision',
    'lock',
  ],
  member: ['view', 'edit', 'upload', 'correct', 'push_rag', 'request_audit'],
};

export const STATUS_META: Record<
  DocumentStatus,
  {
    label: string;
    tone: 'slate' | 'blue' | 'amber' | 'emerald' | 'rose';
    description: string;
  }
> = {
  uploaded: {
    label: '待推送 RAG',
    tone: 'slate',
    description: '文档已完成解析，等待手动推送到知识库。',
  },
  parsing: {
    label: '解析中',
    tone: 'amber',
    description: '系统正在执行解析任务。',
  },
  rag_ready: {
    label: 'RAG 已就绪',
    tone: 'emerald',
    description: '解析与知识库同步已完成，可以提交审核。',
  },
  pending_audit: {
    label: '待审核',
    tone: 'amber',
    description: '员工已提交，等待管理员处理。',
  },
  rejected: {
    label: '已驳回',
    tone: 'rose',
    description: '审核未通过，等待继续修改。',
  },
  published: {
    label: '已发布',
    tone: 'blue',
    description: '当前版本已正式对外可见。',
  },
  locked: {
    label: '已锁定',
    tone: 'slate',
    description: '当前版本已归档，禁止继续修改。',
  },
};
