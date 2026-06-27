/**
 * 前端领域类型定义文件，统一约束文档、目录、任务和搜索结果的数据结构。
 */
export type DocumentStatus =
  | 'uploaded'
  | 'parsing'
  | 'rag_ready'
  | 'pending_audit'
  | 'rejected'
  | 'published'
  | 'locked';

export type JobStatus = 'idle' | 'running' | 'success' | 'failed';
export type DocumentJobType = 'parse' | 'rag';

export type UserRole = 'admin' | 'member';

export type SystemMenuType = 'menu' | 'page' | 'action';

export type PermissionAction =
  | 'view'
  | 'edit'
  | 'upload'
  | 'delete'
  | 'share'
  | 'manage'
  | 'correct'
  | 'push_rag'
  | 'request_audit'
  | 'publish'
  | 'reject'
  | 'create_revision'
  | 'lock';

export type AuditAction =
  | 'upload'
  | 'parse'
  | 'save'
  | 'delete'
  | 'submit'
  | 'publish'
  | 'reject'
  | 'lock'
  | 'unlock'
  | 'reparse'
  | 'rag_sync'
  | 'create_revision';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
  departmentName?: string;
  permissions?: PermissionAction[];
  roles?: RoleOption[];
  menus?: SystemMenuNode[];
  buttonPermissions?: string[];
  avatar?: string;
}

export interface RoleOption {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  builtIn: boolean;
  adminRole: boolean;
}

export interface SystemMenuNode {
  id: string;
  parentId?: string;
  code: string;
  name: string;
  type: SystemMenuType;
  routeKey?: string;
  icon?: string;
  sortOrder: number;
  enabled: boolean;
  children: SystemMenuNode[];
}

export interface AdminRole {
  id: string;
  code: string;
  name: string;
  description?: string;
  enabled: boolean;
  builtIn: boolean;
  adminRole: boolean;
  memberCount: number;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  departmentId: string;
  departmentName?: string;
  enabled: boolean;
  primaryRoleCode: string;
  roles: RoleOption[];
}

export interface AdminDepartment {
  id: string;
  parentId?: string;
  name: string;
  children: AdminDepartment[];
}

export interface DepartmentDeleteCheck {
  departmentId: string;
  departmentName: string;
  parentId?: string;
  parentName?: string;
  childDepartmentCount: number;
  userCount: number;
  folderCount: number;
  documentCount: number;
  topLevel: boolean;
}

export interface RegisteredParseEngine {
  code: string;
  name: string;
  description: string;
}

export interface ParseEngineBindingAdmin {
  id: string;
  fileExtension: string;
  engineCode: string;
  engineName: string;
  isDefault: boolean;
  enabled: boolean;
  sortOrder: number;
}

export interface DocumentJob {
  type: DocumentJobType;
  status: JobStatus;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  attemptCount: number;
  engine?: string;
  lastRunBy?: string;
}

export interface DocumentVersion {
  version: number;
  sourceFileName: string;
  parsedContent: string;
  timestamp: string;
  engine?: string;
  author: string;
  status: 'draft' | 'published' | 'archived';
  summary?: string;
}

export interface AuditRecord {
  id: string;
  version: number;
  action: AuditAction;
  operatorId: string;
  operatorName: string;
  comment?: string;
  createdAt: string;
}

export interface RevisionLink {
  sourceDocumentId: string;
  sourceVersion: number;
}

export interface AccessControlEntry {
  userId: string;
  userName: string;
  role: UserRole;
  permissions: PermissionAction[];
  inheritedFrom?: string;
}

export interface Document {
  id: string;
  name: string;
  description: string;
  tags: string[];
  currentVersion: number;
  liveVersion: number | null;
  status: DocumentStatus;
  departmentId: string;
  folderId?: string;
  latestSourceFile: string;
  latestParsedText: string;
  parseJob: DocumentJob;
  ragJob: DocumentJob;
  rejectedReason?: string | null;
  revisionSource?: RevisionLink;
  liveDocumentId?: string;
  isRevisionDraft?: boolean;
  lockedFromStatus?: Exclude<DocumentStatus, 'locked'> | null;
  versionHistory: DocumentVersion[];
  auditTrail: AuditRecord[];
  accessControl: AccessControlEntry[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  departmentId: string;
  parentId?: string;
  accessControl: AccessControlEntry[];
  createdAt: string;
}

export interface FolderDeleteCheck {
  folderId: string;
  folderName: string;
  empty: boolean;
  childFolderCount: number;
  documentCount: number;
}

export interface Department {
  id: string;
  name: string;
  parentId?: string;
  isLeader?: boolean;
  type?: 'department' | 'user';
}

export interface ParseEngine {
  code: string;
  name: string;
  description: string;
  supportedExtensions: string[];
  isDefault?: boolean;
}

export type ParseArtifactType = 'text' | 'image' | 'markdown';

export interface ParseArtifact {
  id: string;
  artifactType: ParseArtifactType;
  artifactName: string;
  mimeType: string;
  pageNo?: number;
  sequenceNo?: number;
  sizeBytes: number;
  createdAt: string;
  contentUrl: string;
}

export type StatCardIcon = 'documents' | 'audit' | 'rag' | 'published';

export interface StatCard {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  subtext: string;
  icon: StatCardIcon;
}

export type ActivityType =
  | 'upload'
  | 'parse'
  | 'rag'
  | 'audit'
  | 'publish'
  | 'reject'
  | 'delete'
  | 'lock'
  | 'edit';

export interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  createdAt: string;
  type: ActivityType;
  tags?: string[];
}

export interface SearchResult {
  id: string;
  name: string;
  tag?: string;
  snippet: string;
  path: string;
  date: string;
  user?: string;
  status: DocumentStatus;
  sourceDocumentId?: string;
}

export interface DocumentFilters {
  departmentId?: string;
  folderId?: string;
  status?: DocumentStatus;
  query?: string;
  page?: number;
  limit?: number;
}

export interface SearchFilters {
  tags?: string[];
  departments?: string[];
  owners?: string[];
  statuses?: DocumentStatus[];
}

export interface DocumentListResult {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
}

export interface FolderListResult {
  folders: Folder[];
}

export interface SearchResultPage {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
}

export interface DocumentHistory {
  versions: DocumentVersion[];
  audits: AuditRecord[];
}

export type View =
  | 'dashboard'
  | 'library'
  | 'search'
  | 'permission'
  | 'wiki'
  | 'position_packages'
  | 'knowledge_health'
  | 'rag_debug'
  | 'ai_employees'
  | 'settings'
  | 'help';

export interface WikiPage {
  id: string;
  title: string;
  pageType: string;
  summary?: string;
  content?: string;
  status: string;
  syncStatus: string;
  healthStatus: string;
  currentVersion: number;
  departmentId?: string;
  heatScore?: number;
  updatedAt?: string;
}

export interface PositionPackage {
  id: string;
  code: string;
  name: string;
  description?: string;
  positionCode?: string;
  status: string;
  items?: Array<Record<string, unknown>>;
}

export interface HealthIssue {
  id: string;
  issueType: string;
  severity: string;
  title: string;
  description?: string;
  suggestedAction?: string;
  status: string;
  createdAt?: string;
}

export interface HealthReport {
  id: string;
  reportDate: string;
  healthScore: number;
  summary: string;
  metricsJson?: string;
  createdAt?: string;
}

export interface AiEmployee {
  id: string;
  code: string;
  name: string;
  description?: string;
  positionCode?: string;
  departmentId?: string;
  enabled: boolean;
  status: string;
}
