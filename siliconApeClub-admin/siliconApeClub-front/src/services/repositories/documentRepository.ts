/**
 * 前端仓储接口定义，统一约束文档相关的数据访问能力。
 */
import {
  AccessControlEntry,
  ActivityItem,
  Department,
  Document,
  DocumentFilters,
  DocumentHistory,
  DocumentListResult,
  FolderDeleteCheck,
  Folder,
  FolderListResult,
  ParseArtifact,
  ParseEngine,
  SearchFilters,
  SearchResultPage,
  StatCard,
  User,
} from '../../types';

export interface UploadDocumentsInput {
  files: File[];
  folderId?: string;
  uploader: User;
}

export interface SaveCorrectionInput {
  name: string;
  description: string;
  tags: string[];
  latestParsedText: string;
  operator: User;
}

export interface StartParseInput {
  sourceFileName?: string;
  engine?: string;
  operator: User;
}

export interface StartRagSyncInput {
  operator: User;
}

export interface GenerateWikiInput {
  operator: User;
  publish?: boolean;
}

export interface AuditInput {
  operator: User;
}

export interface CreateFolderInput {
  name: string;
  departmentId?: string;
  parentId?: string;
  creator: User;
}

export interface SearchInput {
  q: string;
  filters?: SearchFilters;
  page?: number;
  limit?: number;
}

export interface DocumentSourceAsset {
  blob: Blob;
  contentType: string;
}

export interface DocumentRepository {
  listDocuments(filters?: DocumentFilters): Promise<DocumentListResult>;
  getDocument(id: string): Promise<Document | undefined>;
  uploadDocuments(input: UploadDocumentsInput): Promise<{ documents: Document[] }>;
  saveCorrection(id: string, input: SaveCorrectionInput): Promise<Document>;
  startParse(id: string, input: StartParseInput): Promise<Document>;
  startRagSync(id: string, input: StartRagSyncInput): Promise<Document>;
  generateWiki(id: string, input: GenerateWikiInput): Promise<Document>;
  requestAudit(id: string, input: AuditInput): Promise<Document>;
  rejectAudit(id: string, reason: string, input: AuditInput): Promise<Document>;
  publish(id: string, input: AuditInput): Promise<Document>;
  createRevision(id: string, input: AuditInput): Promise<Document>;
  lockDocument(id: string, input: AuditInput): Promise<Document>;
  unlockDocument(id: string, input: AuditInput): Promise<Document>;
  listHistory(id: string): Promise<DocumentHistory>;
  listParseArtifacts(id: string, version: number): Promise<ParseArtifact[]>;
  fetchParseArtifactContent(id: string, artifactId: string): Promise<DocumentSourceAsset>;
  listParseEngines(fileName: string): Promise<ParseEngine[]>;
  listFolders(filters?: { departmentId?: string; parentId?: string }): Promise<FolderListResult>;
  createFolder(input: CreateFolderInput): Promise<Folder>;
  getFolderDeleteCheck(id: string): Promise<FolderDeleteCheck>;
  deleteFolder(id: string): Promise<{ success: boolean }>;
  getDepartments(): Promise<Department[]>;
  listUsers(): Promise<User[]>;
  fetchDocumentPreview(id: string): Promise<DocumentSourceAsset>;
  fetchDocumentSource(id: string): Promise<DocumentSourceAsset>;
  updateAccessControl(type: 'document' | 'folder', id: string, accessControl: AccessControlEntry[]): Promise<{ success: boolean }>;
  getStats(): Promise<{ stats: StatCard[] }>;
  listActivities(params?: { limit?: number }): Promise<{ activities: ActivityItem[] }>;
  search(input: SearchInput): Promise<SearchResultPage>;
  deleteDocument(id: string): Promise<{ success: boolean }>;
  batchDeleteDocuments(ids: string[]): Promise<{ success: boolean }>;
}
