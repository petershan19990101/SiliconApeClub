/**
 * 前端 HTTP 仓储实现，负责把页面请求映射到后端 REST 接口。
 */
import {
  AccessControlEntry,
  ActivityItem,
  Department,
  Document,
  DocumentHistory,
  DocumentListResult,
  FolderDeleteCheck,
  Folder,
  ParseArtifact,
  ParseEngine,
  SearchResultPage,
  StatCard,
  User,
} from '../../types';
import {
  AuditInput,
  CreateFolderInput,
  DocumentSourceAsset,
  DocumentRepository,
  GenerateWikiInput,
  SaveCorrectionInput,
  SearchInput,
  StartParseInput,
  StartRagSyncInput,
  UploadDocumentsInput,
} from './documentRepository';
import { getAuthToken } from '../../lib/authStorage';
import { parseJsonResponse } from '../json';

const env = import.meta.env as Record<string, string | undefined>;
const API_BASE_URL = env.VITE_API_BASE_URL ?? 'http://localhost:8080';
type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type PageEnvelope<T> = {
  records: T[];
  total: number;
  page: number;
  size: number;
};

type ApiAccessControl = {
  userId: number;
  userName: string;
  role: string;
  permissions: string[];
  inheritedFrom?: string;
};

type ApiUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  departmentId: number | null;
  departmentName?: string | null;
  permissions?: string[];
};

type ApiFolder = {
  id: number;
  name: string;
  departmentId: number;
  parentId?: number | null;
  accessControl: ApiAccessControl[];
  createdAt: string;
};

type ApiDocumentJob = {
  type: string;
  status: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  attemptCount: number;
  engine?: string | null;
  lastRunBy?: string | null;
};

type ApiDocumentVersion = {
  version: number;
  sourceFileName: string;
  parsedContent: string;
  timestamp: string;
  engine?: string | null;
  author: string;
  status: string;
  summary?: string | null;
};

type ApiAuditRecord = {
  id: number;
  version: number;
  action: string;
  operatorId: number;
  operatorName: string;
  comment?: string | null;
  createdAt: string;
};

type ApiDocument = {
  id: number;
  name: string;
  description: string;
  tags: string[];
  currentVersion: number;
  liveVersion?: number | null;
  status: string;
  departmentId: number;
  folderId?: number | null;
  latestSourceFile: string;
  latestParsedText: string;
  parseJob: ApiDocumentJob;
  ragJob: ApiDocumentJob;
  rejectedReason?: string | null;
  revisionSource?: { sourceDocumentId: number; sourceVersion: number } | null;
  liveDocumentId?: number | null;
  revisionDraft?: boolean | null;
  isRevisionDraft?: boolean | null;
  lockedFromStatus?: string | null;
  versionHistory: ApiDocumentVersion[];
  auditTrail: ApiAuditRecord[];
  accessControl: ApiAccessControl[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type ApiSearchResult = {
  id: number;
  name: string;
  tag?: string | null;
  snippet: string;
  path: string;
  date: string;
  user?: string | null;
  status: string;
  sourceDocumentId?: number | null;
};

type ApiParseEngine = {
  code: string;
  name: string;
  description: string;
  supportedExtensions: string[];
  defaultEngine?: boolean | null;
  isDefault?: boolean | null;
};

type ApiParseArtifact = {
  id: number;
  artifactType: string;
  artifactName: string;
  mimeType: string;
  pageNo?: number | null;
  sequenceNo?: number | null;
  sizeBytes: number;
  createdAt: string;
  contentUrl: string;
};

type ApiFolderDeleteCheck = {
  folderId: number;
  folderName: string;
  empty: boolean;
  childFolderCount: number;
  documentCount: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set('Accept', 'application/json');
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(init?.body instanceof FormData) && !headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await parseJsonResponse<ApiEnvelope<T>>(response)
    : null;

  if (!response.ok || (payload && !payload.success)) {
    throw new Error(payload?.message ?? `Request failed with status ${response.status}`);
  }

  return payload ? payload.data : (undefined as unknown as T);
}

async function requestBlob(path: string, init?: RequestInit): Promise<DocumentSourceAsset> {
  const headers = new Headers(init?.headers ?? {});
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  };
}

function toQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

function appendArray(search: URLSearchParams, key: string, values?: string[]) {
  values?.forEach((value) => search.append(key, value));
}

function normalizeRole(role: string) {
  return role.toLowerCase() as 'admin' | 'member';
}

function normalizeStatus(status: string) {
  return status.toLowerCase() as Document['status'];
}

function normalizeJob(job: ApiDocumentJob) {
  return {
    ...job,
    type: job.type.toLowerCase() as Document['parseJob']['type'],
    status: job.status.toLowerCase() as Document['parseJob']['status'],
  };
}

function normalizeAccessControl(entries: ApiAccessControl[]): AccessControlEntry[] {
  return entries.map((entry) => ({
    userId: String(entry.userId),
    userName: entry.userName,
    role: normalizeRole(entry.role),
    permissions: entry.permissions as AccessControlEntry['permissions'],
    inheritedFrom: entry.inheritedFrom ?? undefined,
  }));
}

function normalizeFolder(folder: ApiFolder): Folder {
  return {
    id: String(folder.id),
    name: folder.name,
    departmentId: String(folder.departmentId),
    parentId: folder.parentId == null ? undefined : String(folder.parentId),
    accessControl: normalizeAccessControl(folder.accessControl),
    createdAt: folder.createdAt,
  };
}

function normalizeFolderDeleteCheck(check: ApiFolderDeleteCheck): FolderDeleteCheck {
  return {
    folderId: String(check.folderId),
    folderName: check.folderName,
    empty: check.empty,
    childFolderCount: check.childFolderCount,
    documentCount: check.documentCount,
  };
}

function normalizeUser(user: ApiUser) {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    departmentId: user.departmentId == null ? '' : String(user.departmentId),
    departmentName: user.departmentName ?? undefined,
    permissions: (user.permissions ?? []) as User['permissions'],
    avatar: user.name.slice(0, 1).toUpperCase(),
  };
}

function normalizeDocumentVersion(version: ApiDocumentVersion): Document['versionHistory'][number] {
  return {
    version: version.version,
    sourceFileName: version.sourceFileName,
    parsedContent: version.parsedContent,
    timestamp: version.timestamp,
    engine: version.engine ?? undefined,
    author: version.author,
    status: version.status.toLowerCase() as Document['versionHistory'][number]['status'],
    summary: version.summary ?? undefined,
  };
}

function normalizeAuditRecord(record: ApiAuditRecord): Document['auditTrail'][number] {
  return {
    id: String(record.id),
    version: record.version,
    action: record.action.toLowerCase() as Document['auditTrail'][number]['action'],
    operatorId: String(record.operatorId),
    operatorName: record.operatorName,
    comment: record.comment ?? undefined,
    createdAt: record.createdAt,
  };
}

function normalizeDocument(document: ApiDocument): Document {
  return {
    id: String(document.id),
    name: document.name,
    description: document.description,
    tags: document.tags,
    currentVersion: document.currentVersion,
    liveVersion: document.liveVersion ?? null,
    status: normalizeStatus(document.status),
    departmentId: String(document.departmentId),
    folderId: document.folderId == null ? undefined : String(document.folderId),
    latestSourceFile: document.latestSourceFile,
    latestParsedText: document.latestParsedText,
    parseJob: normalizeJob(document.parseJob),
    ragJob: normalizeJob(document.ragJob),
    rejectedReason: document.rejectedReason ?? null,
    revisionSource: document.revisionSource
      ? {
          sourceDocumentId: String(document.revisionSource.sourceDocumentId),
          sourceVersion: document.revisionSource.sourceVersion,
        }
      : undefined,
    liveDocumentId: document.liveDocumentId == null ? undefined : String(document.liveDocumentId),
    isRevisionDraft: Boolean(document.isRevisionDraft ?? document.revisionDraft),
    lockedFromStatus: document.lockedFromStatus
      ? (normalizeStatus(document.lockedFromStatus) as Exclude<Document['status'], 'locked'>)
      : null,
    versionHistory: document.versionHistory.map(normalizeDocumentVersion),
    auditTrail: document.auditTrail.map(normalizeAuditRecord),
    accessControl: normalizeAccessControl(document.accessControl),
    createdBy: document.createdBy,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function normalizeDepartment(department: { id: number; parentId?: number | null; name: string }): Department {
  return {
    id: String(department.id),
    parentId: department.parentId == null ? undefined : String(department.parentId),
    name: department.name,
  };
}

function normalizeSearchResult(item: ApiSearchResult): SearchResultPage['results'][number] {
  return {
    id: String(item.id),
    name: item.name,
    tag: item.tag ?? undefined,
    snippet: item.snippet,
    path: item.path,
    date: item.date,
    user: item.user ?? undefined,
    status: normalizeStatus(item.status),
    sourceDocumentId: item.sourceDocumentId == null ? undefined : String(item.sourceDocumentId),
  };
}

function normalizeParseEngine(engine: ApiParseEngine): ParseEngine {
  return {
    code: engine.code,
    name: engine.name,
    description: engine.description,
    supportedExtensions: engine.supportedExtensions,
    isDefault: Boolean(engine.defaultEngine ?? engine.isDefault),
  };
}

function normalizeParseArtifact(artifact: ApiParseArtifact): ParseArtifact {
  return {
    id: String(artifact.id),
    artifactType: artifact.artifactType.toLowerCase() as ParseArtifact['artifactType'],
    artifactName: artifact.artifactName,
    mimeType: artifact.mimeType,
    pageNo: artifact.pageNo == null ? undefined : artifact.pageNo,
    sequenceNo: artifact.sequenceNo == null ? undefined : artifact.sequenceNo,
    sizeBytes: artifact.sizeBytes,
    createdAt: artifact.createdAt,
    contentUrl: artifact.contentUrl,
  };
}

function toNumericId(value: string | number | undefined) {
  if (value == null) {
    return undefined;
  }

  const numeric = Number(String(value).replace(/^doc_/, '').replace(/^folder_/, '').replace(/^dept_/, '').replace(/^user_/, ''));
  return Number.isNaN(numeric) ? undefined : numeric;
}

export const httpDocumentRepository: DocumentRepository = {
  async listDocuments(filters = {}) {
    const data = await request<PageEnvelope<ApiDocument>>(
      `/api/documents${toQuery({
        departmentId: toNumericId(filters.departmentId),
        folderId: toNumericId(filters.folderId),
        status: filters.status,
        query: filters.query,
        page: filters.page ?? 1,
        limit: filters.limit ?? 50,
      })}`
    );

    return {
      documents: data.records.map(normalizeDocument),
      total: data.total,
      page: data.page,
      limit: data.size,
    } satisfies DocumentListResult;
  },

  async getDocument(id) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}`);
    return normalizeDocument(data);
  },

  async uploadDocuments(input: UploadDocumentsInput) {
    const formData = new FormData();
    input.files.forEach((file) => formData.append('files', file));
    if (input.folderId) {
      formData.append('folderId', input.folderId);
    }
    const documents = await request<ApiDocument[]>('/api/upload', {
      method: 'POST',
      body: formData,
    });
    return { documents: documents.map(normalizeDocument) };
  },

  async saveCorrection(id: string, input: SaveCorrectionInput) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}/correction`, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        tags: input.tags,
        latestParsedText: input.latestParsedText,
      }),
    });
    return normalizeDocument(data);
  },

  async startParse(id: string, input: StartParseInput) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}/parse`, {
      method: 'POST',
      body: JSON.stringify({
        engine: input.engine,
      }),
    });
    return normalizeDocument(data);
  },

  async startRagSync(id: string, _input: StartRagSyncInput) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}/rag-sync`, {
      method: 'POST',
    });
    return normalizeDocument(data);
  },

  async generateWiki(id: string, input: GenerateWikiInput) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}/to-wiki`, {
      method: 'POST',
      body: JSON.stringify({
        publish: input.publish ?? true,
      }),
    });
    return normalizeDocument(data);
  },

  async requestAudit(id: string, _input: AuditInput) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}/request-audit`, {
      method: 'POST',
    });
    return normalizeDocument(data);
  },

  async rejectAudit(id: string, reason: string, _input: AuditInput) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return normalizeDocument(data);
  },

  async publish(id: string, _input: AuditInput) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}/publish`, {
      method: 'POST',
    });
    return normalizeDocument(data);
  },

  async createRevision(id: string, _input: AuditInput) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}/revision`, {
      method: 'POST',
    });
    return normalizeDocument(data);
  },

  async lockDocument(id: string, _input: AuditInput) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}/lock`, {
      method: 'POST',
    });
    return normalizeDocument(data);
  },

  async unlockDocument(id: string, _input: AuditInput) {
    const data = await request<ApiDocument>(`/api/documents/${toNumericId(id)}/unlock`, {
      method: 'POST',
    });
    return normalizeDocument(data);
  },

  async listHistory(id: string) {
    const data = await request<{
      versions: ApiDocumentVersion[];
      audits: ApiAuditRecord[];
    }>(`/api/documents/${toNumericId(id)}/history`);
    return {
      versions: data.versions.map(normalizeDocumentVersion),
      audits: data.audits.map(normalizeAuditRecord),
    } as DocumentHistory;
  },

  async listParseArtifacts(id: string, version: number) {
    const data = await request<ApiParseArtifact[]>(
      `/api/documents/${toNumericId(id)}/parse-artifacts${toQuery({ version })}`
    );
    return data.map(normalizeParseArtifact);
  },

  async fetchParseArtifactContent(id: string, artifactId: string) {
    return requestBlob(
      `/api/documents/${toNumericId(id)}/parse-artifacts/${toNumericId(artifactId)}/content`
    );
  },

  async listParseEngines(fileName: string) {
    const data = await request<ApiParseEngine[]>(`/api/parse-engines${toQuery({ fileName })}`);
    return data.map(normalizeParseEngine);
  },

  async listFolders(filters = {}) {
    const folders = await request<ApiFolder[]>(
      `/api/folders${toQuery({
        departmentId: toNumericId(filters.departmentId),
        parentId: toNumericId(filters.parentId),
      })}`
    );
    return { folders: folders.map(normalizeFolder) };
  },

  async createFolder(input: CreateFolderInput) {
    const data = await request<ApiFolder>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        departmentId: toNumericId(input.departmentId),
        parentId: toNumericId(input.parentId),
      }),
    });
    return normalizeFolder(data);
  },

  async getFolderDeleteCheck(id: string) {
    const data = await request<ApiFolderDeleteCheck>(`/api/folders/${toNumericId(id)}/delete-check`);
    return normalizeFolderDeleteCheck(data);
  },

  async deleteFolder(id: string) {
    await request<void>(`/api/folders/${toNumericId(id)}`, {
      method: 'DELETE',
    });
    return { success: true };
  },

  async getDepartments() {
    const data = await request<Array<{ id: number; parentId?: number | null; name: string }>>('/api/departments');
    return data.map(normalizeDepartment);
  },

  async listUsers() {
    const users = await request<ApiUser[]>('/api/users');
    return users.map(normalizeUser);
  },

  async fetchDocumentPreview(id: string) {
    return requestBlob(`/api/documents/${toNumericId(id)}/preview-file`);
  },

  async fetchDocumentSource(id: string) {
    return requestBlob(`/api/documents/${toNumericId(id)}/source-file`);
  },

  async updateAccessControl(type: 'document' | 'folder', id: string, accessControl: AccessControlEntry[]) {
    const payload = {
      accessControl: accessControl.map((entry) => ({
        userId: Number(String(entry.userId).replace(/^user_/, '')),
        userName: entry.userName,
        role: entry.role.toUpperCase(),
        permissions: entry.permissions,
        inheritedFrom: entry.inheritedFrom,
      })),
    };

    await request<void>(`/api/${type === 'document' ? 'documents' : 'folders'}/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    return { success: true };
  },

  async getStats() {
    const stats = await request<StatCard[]>('/api/dashboard/stats');
    return { stats };
  },

  async listActivities(params = {}) {
    const activities = await request<ActivityItem[]>(`/api/dashboard/activities${toQuery({ limit: params.limit ?? 10 })}`);
    return { activities };
  },

  async search(input: SearchInput) {
    const search = new URLSearchParams();
    search.set('q', input.q);
    search.set('page', String(input.page ?? 1));
    search.set('limit', String(input.limit ?? 20));
    appendArray(search, 'departments', input.filters?.departments);
    appendArray(search, 'owners', input.filters?.owners);
    appendArray(search, 'tags', input.filters?.tags);
    appendArray(search, 'statuses', input.filters?.statuses);

    const data = await request<PageEnvelope<ApiSearchResult>>(`/api/search?${search.toString()}`);
    return {
      results: data.records.map(normalizeSearchResult),
      total: data.total,
      page: data.page,
      limit: data.size,
    };
  },

  async deleteDocument(id: string) {
    await request<void>(`/api/documents/${toNumericId(id)}`, {
      method: 'DELETE',
    });
    return { success: true };
  },

  async batchDeleteDocuments(ids: string[]) {
    await request<void>('/api/documents/batch', {
      method: 'DELETE',
      body: JSON.stringify({
        ids: ids.map((id) => toNumericId(id)).filter((value): value is number => value !== undefined),
      }),
    });
    return { success: true };
  },
};
