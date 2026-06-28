import {
  AdminDepartment,
  AiEmployee,
  CustomerMember,
  CustomerVisibility,
  EmployeeAssessmentRule,
  EmployeeContactRelation,
  EmployeePerformance,
  EmployeeSkillBinding,
  HealthIssue,
  HealthReport,
  HrRole,
  IndexedChunk,
  ModelProfile,
  OrgHumanCenterOverview,
  PositionKnowledgeItem,
  PositionPackage,
  RagAclBinding,
  RagAclPolicy,
  SkillRepositoryItem,
  WikiPage,
  WikiRelation,
  WikiStructureGroup,
} from '../types';
import { getAuthToken } from '../lib/authStorage';
import { parseJsonResponse } from './json';

const env = import.meta.env as Record<string, string | undefined>;
const API_BASE_URL = env.VITE_API_BASE_URL ?? 'http://localhost:8080';

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set('Accept', 'application/json');
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const payload = await parseJsonResponse<ApiEnvelope<T>>(response);
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Request failed with status ${response.status}`);
  }
  return payload.data;
}

function normalizeRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value == null ? undefined : value])) as T;
}

function normalizePositionKnowledgeItem(item: Record<string, unknown>): PositionKnowledgeItem {
  return {
    id: item.id == null ? undefined : String(item.id),
    packageId: item.packageId == null ? undefined : String(item.packageId),
    itemType: String(item.itemType ?? 'wiki_page'),
    itemId: String(item.itemId ?? ''),
    required: item.required === true || item.required === 1,
    sortOrder: Number(item.sortOrder ?? 0),
    wikiTitle: item.wikiTitle == null ? undefined : String(item.wikiTitle),
    wikiStatus: item.wikiStatus == null ? undefined : String(item.wikiStatus),
  };
}

function normalizePositionPackage(item: Record<string, unknown>): PositionPackage {
  return {
    id: String(item.id),
    code: String(item.code ?? ''),
    name: String(item.name ?? ''),
    description: item.description == null ? undefined : String(item.description),
    positionCode: item.positionCode == null ? undefined : String(item.positionCode),
    status: String(item.status ?? ''),
    itemCount: item.itemCount == null ? undefined : Number(item.itemCount),
    items: Array.isArray(item.items) ? item.items.map((entry) => normalizePositionKnowledgeItem(entry as Record<string, unknown>)) : undefined,
  };
}

function normalizeAiEmployee(item: Record<string, unknown>): AiEmployee {
  return {
    id: String(item.id),
    code: String(item.code ?? ''),
    name: String(item.name ?? ''),
    description: item.description == null ? undefined : String(item.description),
    positionCode: item.positionCode == null ? undefined : String(item.positionCode),
    departmentId: item.departmentId == null ? undefined : String(item.departmentId),
    departmentName: item.departmentName == null ? undefined : String(item.departmentName),
    roleTitle: item.roleTitle == null ? undefined : String(item.roleTitle),
    responsibilities: item.responsibilities == null ? undefined : String(item.responsibilities),
    skillsJson: item.skillsJson == null ? undefined : String(item.skillsJson),
    contactRelationsJson: item.contactRelationsJson == null ? undefined : String(item.contactRelationsJson),
    memoryPolicyJson: item.memoryPolicyJson == null ? undefined : String(item.memoryPolicyJson),
    modelConfigJson: item.modelConfigJson == null ? undefined : String(item.modelConfigJson),
    hrRoleCode: item.hrRoleCode == null ? undefined : String(item.hrRoleCode),
    managerEmployeeId: item.managerEmployeeId == null ? undefined : String(item.managerEmployeeId),
    managerName: item.managerName == null ? undefined : String(item.managerName),
    employmentType: item.employmentType == null ? undefined : String(item.employmentType),
    costRate: item.costRate == null ? undefined : Number(item.costRate),
    performanceStatus: item.performanceStatus == null ? undefined : String(item.performanceStatus),
    enabled: item.enabled === true || item.enabled === 1,
    status: String(item.status ?? ''),
    offlineReason: item.offlineReason == null ? undefined : String(item.offlineReason),
    leftAt: item.leftAt == null ? undefined : String(item.leftAt),
    skillCount: item.skillCount == null ? undefined : Number(item.skillCount),
    totalTokens: item.totalTokens == null ? undefined : Number(item.totalTokens),
    memoryItems: item.memoryItems == null ? undefined : Number(item.memoryItems),
    packages: Array.isArray(item.packages) ? item.packages.map((pkg) => normalizePositionPackage(pkg as Record<string, unknown>)) : undefined,
    contacts: Array.isArray(item.contacts) ? item.contacts.map((contact) => normalizeEmployeeContact(contact as Record<string, unknown>)) : undefined,
    skills: Array.isArray(item.skills) ? item.skills.map((skill) => normalizeEmployeeSkillBinding(skill as Record<string, unknown>)) : undefined,
    assessmentRules: Array.isArray(item.assessmentRules) ? item.assessmentRules.map((rule) => normalizeEmployeeAssessmentRule(rule as Record<string, unknown>)) : undefined,
    performance: item.performance && typeof item.performance === 'object' ? normalizeEmployeePerformance(item.performance as Record<string, unknown>) : undefined,
  };
}

function normalizeEmployeeContact(item: Record<string, unknown>): EmployeeContactRelation {
  return {
    id: String(item.id),
    aiEmployeeId: String(item.aiEmployeeId ?? ''),
    relatedEmployeeId: String(item.relatedEmployeeId ?? ''),
    relatedEmployeeName: item.relatedEmployeeName == null ? undefined : String(item.relatedEmployeeName),
    relatedRoleTitle: item.relatedRoleTitle == null ? undefined : String(item.relatedRoleTitle),
    relationType: String(item.relationType ?? ''),
    description: item.description == null ? undefined : String(item.description),
  };
}

function normalizeEmployeeSkillBinding(item: Record<string, unknown>): EmployeeSkillBinding {
  return {
    id: String(item.id),
    aiEmployeeId: item.aiEmployeeId == null ? undefined : String(item.aiEmployeeId),
    skillId: String(item.skillId ?? item.id ?? ''),
    code: item.code == null ? undefined : String(item.code),
    name: String(item.name ?? ''),
    description: item.description == null ? undefined : String(item.description),
    departmentId: item.departmentId == null ? undefined : String(item.departmentId),
    departmentName: item.departmentName == null ? undefined : String(item.departmentName),
    skillType: String(item.skillType ?? 'tool'),
    skillLevel: String(item.skillLevel ?? 'basic'),
    invocationMode: item.invocationMode == null ? undefined : String(item.invocationMode),
    reviewStatus: item.reviewStatus == null ? undefined : String(item.reviewStatus),
    required: item.required == null ? undefined : item.required === true || item.required === 1,
    sortOrder: item.sortOrder == null ? undefined : Number(item.sortOrder),
    enabled: item.enabled == null ? undefined : item.enabled === true || item.enabled === 1,
  };
}

function normalizeEmployeeAssessmentRule(item: Record<string, unknown>): EmployeeAssessmentRule {
  return {
    id: item.id == null ? undefined : String(item.id),
    aiEmployeeId: item.aiEmployeeId == null ? undefined : String(item.aiEmployeeId),
    metricKey: String(item.metricKey ?? ''),
    metricLabel: String(item.metricLabel ?? ''),
    metricType: String(item.metricType ?? 'count'),
    targetValue: Number(item.targetValue ?? 0),
    actualValue: item.actualValue == null ? undefined : Number(item.actualValue),
    weight: Number(item.weight ?? 1),
    unit: String(item.unit ?? 'count'),
    enabled: item.enabled == null ? true : item.enabled === true || item.enabled === 1,
  };
}

function normalizeEmployeePerformance(item: Record<string, unknown>): EmployeePerformance {
  const usage = item.usage && typeof item.usage === 'object' ? item.usage as Record<string, unknown> : {};
  return {
    usage: {
      inputTokens: Number(usage.inputTokens ?? 0),
      outputTokens: Number(usage.outputTokens ?? 0),
      totalTokens: Number(usage.totalTokens ?? 0),
      memoryBytes: Number(usage.memoryBytes ?? 0),
      memoryItems: Number(usage.memoryItems ?? 0),
      costAmount: Number(usage.costAmount ?? 0),
    },
    rules: Array.isArray(item.rules) ? item.rules.map((rule) => normalizeEmployeeAssessmentRule(rule as Record<string, unknown>)) : [],
    taskMemoryCount: Number(item.taskMemoryCount ?? 0),
    wikiProposalCount: Number(item.wikiProposalCount ?? 0),
    workerTaskCount: Number(item.workerTaskCount ?? 0),
    approvedSkillCount: Number(item.approvedSkillCount ?? 0),
  };
}

function normalizeSkillRepositoryItem(item: Record<string, unknown>): SkillRepositoryItem {
  return {
    id: String(item.id),
    code: String(item.code ?? ''),
    name: String(item.name ?? ''),
    description: item.description == null ? undefined : String(item.description),
    departmentId: item.departmentId == null ? undefined : String(item.departmentId),
    departmentName: item.departmentName == null ? undefined : String(item.departmentName),
    skillType: String(item.skillType ?? 'tool'),
    skillLevel: String(item.skillLevel ?? 'basic'),
    invocationMode: String(item.invocationMode ?? 'tool_call'),
    inputSchemaJson: item.inputSchemaJson == null ? undefined : String(item.inputSchemaJson),
    outputSchemaJson: item.outputSchemaJson == null ? undefined : String(item.outputSchemaJson),
    orchestrationConfigJson: item.orchestrationConfigJson == null ? undefined : String(item.orchestrationConfigJson),
    guardrailsJson: item.guardrailsJson == null ? undefined : String(item.guardrailsJson),
    sourceType: String(item.sourceType ?? 'human'),
    sourceEmployeeId: item.sourceEmployeeId == null ? undefined : String(item.sourceEmployeeId),
    sourceEmployeeName: item.sourceEmployeeName == null ? undefined : String(item.sourceEmployeeName),
    reviewStatus: String(item.reviewStatus ?? 'draft'),
    enabled: item.enabled == null ? true : item.enabled === true || item.enabled === 1,
    bindingCount: item.bindingCount == null ? undefined : Number(item.bindingCount),
    createdBy: item.createdBy == null ? undefined : String(item.createdBy),
    reviewedBy: item.reviewedBy == null ? undefined : String(item.reviewedBy),
    reviewedAt: item.reviewedAt == null ? undefined : String(item.reviewedAt),
    createdAt: item.createdAt == null ? undefined : String(item.createdAt),
    updatedAt: item.updatedAt == null ? undefined : String(item.updatedAt),
    bindings: Array.isArray(item.bindings) ? item.bindings as Array<Record<string, unknown>> : undefined,
  };
}

function normalizeDepartment(item: Record<string, unknown>): AdminDepartment {
  return {
    id: String(item.id),
    code: item.code == null ? undefined : String(item.code),
    parentId: item.parentId == null ? undefined : String(item.parentId),
    name: String(item.name ?? ''),
    unitType: item.unitType == null ? undefined : String(item.unitType),
    description: item.description == null ? undefined : String(item.description),
    sortOrder: item.sortOrder == null ? undefined : Number(item.sortOrder),
    enabled: item.enabled == null ? undefined : item.enabled === true || item.enabled === 1,
    children: Array.isArray(item.children) ? item.children.map((child) => normalizeDepartment(child as Record<string, unknown>)) : [],
  };
}

function normalizeHrRole(item: Record<string, unknown>): HrRole {
  return {
    id: String(item.id),
    code: String(item.code ?? ''),
    name: String(item.name ?? ''),
    description: item.description == null ? undefined : String(item.description),
    permissionsJson: item.permissionsJson == null ? undefined : String(item.permissionsJson),
    enabled: item.enabled === true || item.enabled === 1,
  };
}

function normalizeModelProfile(item: Record<string, unknown>): ModelProfile {
  return {
    id: String(item.id),
    code: String(item.code ?? ''),
    name: String(item.name ?? ''),
    provider: String(item.provider ?? ''),
    modelName: String(item.modelName ?? ''),
    purpose: item.purpose == null ? undefined : String(item.purpose),
    configJson: item.configJson == null ? undefined : String(item.configJson),
    enabled: item.enabled === true || item.enabled === 1,
  };
}

function normalizeCustomerMember(item: Record<string, unknown>): CustomerMember {
  return {
    id: String(item.id),
    code: String(item.code ?? ''),
    name: String(item.name ?? ''),
    customerType: String(item.customerType ?? 'external'),
    principalCode: item.principalCode == null ? undefined : String(item.principalCode),
    contactName: item.contactName == null ? undefined : String(item.contactName),
    contactEmail: item.contactEmail == null ? undefined : String(item.contactEmail),
    status: String(item.status ?? ''),
    metadataJson: item.metadataJson == null ? undefined : String(item.metadataJson),
  };
}

function normalizeCustomerVisibility(item: Record<string, unknown>): CustomerVisibility {
  return {
    id: String(item.id),
    customerId: String(item.customerId ?? ''),
    customerName: item.customerName == null ? undefined : String(item.customerName),
    departmentId: item.departmentId == null ? undefined : String(item.departmentId),
    departmentName: item.departmentName == null ? undefined : String(item.departmentName),
    aiEmployeeId: item.aiEmployeeId == null ? undefined : String(item.aiEmployeeId),
    employeeName: item.employeeName == null ? undefined : String(item.employeeName),
    roleTitle: item.roleTitle == null ? undefined : String(item.roleTitle),
    visibilityType: String(item.visibilityType ?? 'visible'),
    canConsult: item.canConsult == null ? undefined : item.canConsult === true || item.canConsult === 1,
    canAssign: item.canAssign == null ? undefined : item.canAssign === true || item.canAssign === 1,
  };
}

function normalizeIndexedChunk(item: Record<string, unknown>): IndexedChunk {
  return {
    id: String(item.id),
    sourceType: String(item.sourceType ?? ''),
    sourceId: String(item.sourceId ?? ''),
    sourceVersion: Number(item.sourceVersion ?? 0),
    wikiPageId: item.wikiPageId == null ? undefined : String(item.wikiPageId),
    wikiPageVersion: item.wikiPageVersion == null ? undefined : Number(item.wikiPageVersion),
    sourceTitle: String(item.sourceTitle ?? '未命名知识'),
    chunkSummary: item.chunkSummary == null ? undefined : String(item.chunkSummary),
    aclPolicyId: item.aclPolicyId == null ? undefined : String(item.aclPolicyId),
    policyName: item.policyName == null ? undefined : String(item.policyName),
    securityLevel: item.securityLevel == null ? undefined : String(item.securityLevel),
    departmentTags: item.departmentTags == null ? undefined : String(item.departmentTags),
    positionTags: item.positionTags == null ? undefined : String(item.positionTags),
    knowledgeStatus: String(item.knowledgeStatus ?? ''),
    preview: String(item.preview ?? ''),
    createdAt: item.createdAt == null ? undefined : String(item.createdAt),
    updatedAt: item.updatedAt == null ? undefined : String(item.updatedAt),
  };
}

function normalizeRagAclPolicy(item: Record<string, unknown>): RagAclPolicy {
  return {
    id: String(item.id),
    policyName: String(item.policyName ?? ''),
    securityLevel: String(item.securityLevel ?? 'internal'),
    aclVersion: Number(item.aclVersion ?? 1),
    status: String(item.status ?? 'active'),
    bindingCount: item.bindingCount == null ? undefined : Number(item.bindingCount),
    activeChunkCount: item.activeChunkCount == null ? undefined : Number(item.activeChunkCount),
    createdAt: item.createdAt == null ? undefined : String(item.createdAt),
    updatedAt: item.updatedAt == null ? undefined : String(item.updatedAt),
  };
}

function normalizeRagAclBinding(item: Record<string, unknown>): RagAclBinding {
  return {
    id: String(item.id),
    policyId: String(item.policyId ?? ''),
    policyName: item.policyName == null ? undefined : String(item.policyName),
    principalType: String(item.principalType ?? 'department'),
    principalId: String(item.principalId ?? ''),
    action: String(item.action ?? 'use_in_rag'),
    effect: String(item.effect ?? 'allow'),
    createdAt: item.createdAt == null ? undefined : String(item.createdAt),
  };
}

function normalizeWikiPage(item: Record<string, unknown>): WikiPage {
  return {
    id: String(item.id),
    title: String(item.title ?? ''),
    pageType: String(item.pageType ?? 'general'),
    summary: item.summary == null ? undefined : String(item.summary),
    content: item.content == null ? undefined : String(item.content),
    status: String(item.status ?? ''),
    syncStatus: String(item.syncStatus ?? ''),
    healthStatus: String(item.healthStatus ?? ''),
    currentVersion: Number(item.currentVersion ?? 1),
    departmentId: item.departmentId == null ? undefined : String(item.departmentId),
    departmentName: item.departmentName == null ? undefined : String(item.departmentName),
    aclPolicyId: item.aclPolicyId == null ? undefined : String(item.aclPolicyId),
    aclPolicyName: item.aclPolicyName == null ? undefined : String(item.aclPolicyName),
    aclBindingCount: item.aclBindingCount == null ? undefined : Number(item.aclBindingCount),
    securityLevel: item.securityLevel == null ? undefined : String(item.securityLevel),
    relationCount: item.relationCount == null ? undefined : Number(item.relationCount),
    heatScore: item.heatScore == null ? undefined : Number(item.heatScore),
    createdAt: item.createdAt == null ? undefined : String(item.createdAt),
    updatedAt: item.updatedAt == null ? undefined : String(item.updatedAt),
  };
}

function normalizeWikiRelation(item: Record<string, unknown>): WikiRelation {
  return {
    id: String(item.id),
    sourcePageId: String(item.sourcePageId ?? ''),
    sourceTitle: item.sourceTitle == null ? undefined : String(item.sourceTitle),
    targetPageId: String(item.targetPageId ?? ''),
    targetTitle: item.targetTitle == null ? undefined : String(item.targetTitle),
    relationType: String(item.relationType ?? 'related_to') as WikiRelation['relationType'],
    direction: String(item.direction ?? 'outgoing') as WikiRelation['direction'],
    createdAt: item.createdAt == null ? undefined : String(item.createdAt),
  };
}

function normalizeWikiStructureGroup(item: Record<string, unknown>): WikiStructureGroup {
  return {
    type: String(item.type ?? 'status') as WikiStructureGroup['type'],
    value: String(item.value ?? ''),
    label: String(item.label ?? ''),
    count: Number(item.count ?? 0),
    children: Array.isArray(item.children) ? item.children.map((child) => normalizeWikiStructureGroup(child as Record<string, unknown>)) : [],
  };
}

function wikiPageQuery(options: { query?: string; status?: string; departmentId?: string; pageType?: string } = {}) {
  const params = new URLSearchParams();
  if (options.query) {
    params.set('query', options.query);
  }
  if (options.status) {
    params.set('status', options.status);
  }
  if (options.departmentId) {
    params.set('departmentId', options.departmentId);
  }
  if (options.pageType) {
    params.set('pageType', options.pageType);
  }
  return params.toString() ? `?${params.toString()}` : '';
}

export const knowledgeApi = {
  listWikiPages: async (query = '', status = '', filters: { departmentId?: string; pageType?: string } = {}) => {
    const data = await request<Array<Record<string, unknown>>>(`/api/wiki/pages${wikiPageQuery({ query, status, ...filters })}`);
    return data.map(normalizeWikiPage);
  },
  getWikiStructure: async (groupBy = 'department,pageType,status', query = '', status = '') => {
    const params = new URLSearchParams({ groupBy });
    if (query) {
      params.set('query', query);
    }
    if (status) {
      params.set('status', status);
    }
    const data = await request<Record<string, unknown>>(`/api/wiki/structure?${params.toString()}`);
    return {
      groupBy: String(data.groupBy ?? groupBy),
      total: Number(data.total ?? 0),
      filters: data.filters as Record<string, unknown> | undefined,
      groups: Array.isArray(data.groups) ? data.groups.map((item) => normalizeWikiStructureGroup(item as Record<string, unknown>)) : [],
    };
  },
  getWikiPage: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/wiki/pages/${id}`);
    return normalizeWikiPage(data);
  },
  createWikiPage: async (payload: Partial<WikiPage>) => {
    const data = await request<Record<string, unknown>>('/api/wiki/pages', { method: 'POST', body: JSON.stringify(normalizeRecord(payload as Record<string, unknown>)) });
    return normalizeWikiPage(data);
  },
  updateWikiPage: async (id: string, payload: Partial<WikiPage>) => {
    const data = await request<Record<string, unknown>>(`/api/wiki/pages/${id}`, { method: 'PUT', body: JSON.stringify(normalizeRecord(payload as Record<string, unknown>)) });
    return normalizeWikiPage(data);
  },
  publishWikiPage: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/wiki/pages/${id}/publish`, { method: 'POST' });
    return normalizeWikiPage(data);
  },
  archiveWikiPage: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/wiki/pages/${id}/archive`, { method: 'POST' });
    return normalizeWikiPage(data);
  },
  deleteWikiPage: (id: string) => request<void>(`/api/wiki/pages/${id}`, { method: 'DELETE' }),
  getWikiSyncStatus: (id: string) => request<Record<string, unknown>>(`/api/wiki/pages/${id}/sync-status`),
  listWikiRelations: async (id: string) => {
    const data = await request<Array<Record<string, unknown>>>(`/api/wiki/pages/${id}/relations`);
    return data.map(normalizeWikiRelation);
  },
  createWikiRelation: async (id: string, payload: { targetPageId: string; relationType: WikiRelation['relationType'] }) => {
    const data = await request<Record<string, unknown>>(`/api/wiki/pages/${id}/relations`, { method: 'POST', body: JSON.stringify(payload) });
    return normalizeWikiRelation(data);
  },
  deleteWikiRelation: (id: string, relationId: string) => request<void>(`/api/wiki/pages/${id}/relations/${relationId}`, { method: 'DELETE' }),

  listPositionPackages: async () => {
    const data = await request<Array<Record<string, unknown>>>('/api/position-packages');
    return data.map(normalizePositionPackage);
  },
  getPositionPackage: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/position-packages/${id}`);
    return normalizePositionPackage(data);
  },
  createPositionPackage: (payload: Partial<PositionPackage>) =>
    request<PositionPackage>('/api/position-packages', { method: 'POST', body: JSON.stringify(payload) }),
  updatePositionPackage: (id: string, payload: Partial<PositionPackage>) =>
    request<PositionPackage>(`/api/position-packages/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  replacePositionPackageItems: (id: string, items: Array<Partial<PositionKnowledgeItem>>) =>
    request<PositionPackage>(`/api/position-packages/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) }),
  submitPositionPackageReview: (id: string) => request<PositionPackage>(`/api/position-packages/${id}/submit-review`, { method: 'POST' }),
  publishPositionPackage: (id: string) => request<PositionPackage>(`/api/position-packages/${id}/publish`, { method: 'POST' }),
  rejectPositionPackage: (id: string) => request<PositionPackage>(`/api/position-packages/${id}/reject`, { method: 'POST' }),
  archivePositionPackage: (id: string) => request<PositionPackage>(`/api/position-packages/${id}/archive`, { method: 'POST' }),
  deletePositionPackage: (id: string) => request<void>(`/api/position-packages/${id}`, { method: 'DELETE' }),

  listHealthIssues: () => request<HealthIssue[]>('/api/knowledge-health/issues'),
  listHealthReports: () => request<HealthReport[]>('/api/knowledge-health/reports'),
  generateHealthReport: () => request<HealthReport>('/api/knowledge-health/reports/generate', { method: 'POST' }),
  getMaintenanceWindow: () => request<Record<string, unknown>>('/api/knowledge-health/maintenance-window'),
  startMaintenanceWindow: (reason: string) =>
    request<Record<string, unknown>>('/api/knowledge-health/maintenance-window/start', { method: 'POST', body: JSON.stringify({ reason }) }),
  endMaintenanceWindow: () => request<Record<string, unknown>>('/api/knowledge-health/maintenance-window/end', { method: 'POST' }),

  listAiEmployees: async () => {
    const data = await request<Array<Record<string, unknown>>>('/api/admin/ai-employees');
    return data.map(normalizeAiEmployee);
  },
  getOrgHumanCenter: async (): Promise<OrgHumanCenterOverview> => {
    const data = await request<Record<string, unknown>>('/api/admin/org-human-center');
    return {
      departments: Array.isArray(data.departments) ? data.departments.map((item) => normalizeDepartment(item as Record<string, unknown>)) : [],
      positions: Array.isArray(data.positions) ? data.positions.map((item) => normalizeRecord(item as Record<string, unknown>)) : [],
      roles: Array.isArray(data.roles) ? data.roles.map((item) => normalizeHrRole(item as Record<string, unknown>)) : [],
      modelProfiles: Array.isArray(data.modelProfiles) ? data.modelProfiles.map((item) => normalizeModelProfile(item as Record<string, unknown>)) : [],
      employees: Array.isArray(data.employees) ? data.employees.map((item) => normalizeAiEmployee(item as Record<string, unknown>)) : [],
      skills: Array.isArray(data.skills) ? data.skills.map((item) => normalizeSkillRepositoryItem(item as Record<string, unknown>)) : [],
      customers: Array.isArray(data.customers) ? data.customers.map((item) => normalizeCustomerMember(item as Record<string, unknown>)) : [],
      customerRoles: Array.isArray(data.customerRoles) ? data.customerRoles.map((item) => normalizeHrRole(item as Record<string, unknown>)) : [],
      customerDepartmentVisibility: Array.isArray(data.customerDepartmentVisibility)
        ? data.customerDepartmentVisibility.map((item) => normalizeCustomerVisibility(item as Record<string, unknown>))
        : [],
      customerEmployeeVisibility: Array.isArray(data.customerEmployeeVisibility)
        ? data.customerEmployeeVisibility.map((item) => normalizeCustomerVisibility(item as Record<string, unknown>))
        : [],
    };
  },
  updateCustomerVisibility: async (
    customerId: string,
    payload: { departmentIds: string[]; employees: Array<{ aiEmployeeId: string; canConsult: boolean; canAssign: boolean }> }
  ): Promise<OrgHumanCenterOverview> => {
    const data = await request<Record<string, unknown>>(`/api/admin/org-human-center/customers/${customerId}/visibility`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return {
      departments: Array.isArray(data.departments) ? data.departments.map((item) => normalizeDepartment(item as Record<string, unknown>)) : [],
      positions: Array.isArray(data.positions) ? data.positions.map((item) => normalizeRecord(item as Record<string, unknown>)) : [],
      roles: Array.isArray(data.roles) ? data.roles.map((item) => normalizeHrRole(item as Record<string, unknown>)) : [],
      modelProfiles: Array.isArray(data.modelProfiles) ? data.modelProfiles.map((item) => normalizeModelProfile(item as Record<string, unknown>)) : [],
      employees: Array.isArray(data.employees) ? data.employees.map((item) => normalizeAiEmployee(item as Record<string, unknown>)) : [],
      skills: Array.isArray(data.skills) ? data.skills.map((item) => normalizeSkillRepositoryItem(item as Record<string, unknown>)) : [],
      customers: Array.isArray(data.customers) ? data.customers.map((item) => normalizeCustomerMember(item as Record<string, unknown>)) : [],
      customerRoles: Array.isArray(data.customerRoles) ? data.customerRoles.map((item) => normalizeHrRole(item as Record<string, unknown>)) : [],
      customerDepartmentVisibility: Array.isArray(data.customerDepartmentVisibility)
        ? data.customerDepartmentVisibility.map((item) => normalizeCustomerVisibility(item as Record<string, unknown>))
        : [],
      customerEmployeeVisibility: Array.isArray(data.customerEmployeeVisibility)
        ? data.customerEmployeeVisibility.map((item) => normalizeCustomerVisibility(item as Record<string, unknown>))
        : [],
    };
  },
  getAiEmployee: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/admin/ai-employees/${id}`);
    return normalizeAiEmployee(data);
  },
  createAiEmployee: async (payload: Partial<AiEmployee>) => {
    const data = await request<Record<string, unknown>>('/api/admin/ai-employees', { method: 'POST', body: JSON.stringify(payload) });
    return normalizeAiEmployee(data);
  },
  updateAiEmployee: async (id: string, payload: Partial<AiEmployee>) => {
    const data = await request<Record<string, unknown>>(`/api/admin/ai-employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return normalizeAiEmployee(data);
  },
  updateAiEmployeePackages: async (id: string, packageIds: string[]) => {
    const data = await request<Record<string, unknown>>(`/api/admin/ai-employees/${id}/position-packages`, {
      method: 'PUT',
      body: JSON.stringify({ packageIds: packageIds.map((item) => Number(item)) }),
    });
    return normalizeAiEmployee(data);
  },
  updateAiEmployeeSkills: async (id: string, skillIds: string[]) => {
    const data = await request<Record<string, unknown>>(`/api/admin/ai-employees/${id}/skills`, {
      method: 'PUT',
      body: JSON.stringify({ skillIds: skillIds.map((item) => Number(item)) }),
    });
    return normalizeAiEmployee(data);
  },
  updateAiEmployeeAssessmentRules: async (id: string, rules: EmployeeAssessmentRule[]) => {
    const data = await request<Record<string, unknown>>(`/api/admin/ai-employees/${id}/assessment-rules`, {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    });
    return normalizeAiEmployee(data);
  },
  getAiEmployeePerformance: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/admin/ai-employees/${id}/performance`);
    return normalizeEmployeePerformance(data);
  },
  offlineAiEmployee: async (id: string, reason = '离职/下线') => {
    const data = await request<Record<string, unknown>>(`/api/admin/ai-employees/${id}/offline`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return normalizeAiEmployee(data);
  },
  recordAiEmployeeUsage: async (id: string, payload: Record<string, unknown>) => {
    const data = await request<Record<string, unknown>>(`/api/admin/ai-employees/${id}/usage-records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeEmployeePerformance(data);
  },
  listSkillRepository: async (reviewStatus = '') => {
    const query = reviewStatus ? `?reviewStatus=${encodeURIComponent(reviewStatus)}` : '';
    const data = await request<Array<Record<string, unknown>>>(`/api/admin/skill-repository${query}`);
    return data.map(normalizeSkillRepositoryItem);
  },
  getSkillRepositoryItem: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/admin/skill-repository/${id}`);
    return normalizeSkillRepositoryItem(data);
  },
  createSkillRepositoryItem: async (payload: Partial<SkillRepositoryItem>) => {
    const data = await request<Record<string, unknown>>('/api/admin/skill-repository', { method: 'POST', body: JSON.stringify(payload) });
    return normalizeSkillRepositoryItem(data);
  },
  updateSkillRepositoryItem: async (id: string, payload: Partial<SkillRepositoryItem>) => {
    const data = await request<Record<string, unknown>>(`/api/admin/skill-repository/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return normalizeSkillRepositoryItem(data);
  },
  submitSkillRepositoryReview: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/admin/skill-repository/${id}/submit-review`, { method: 'POST' });
    return normalizeSkillRepositoryItem(data);
  },
  approveSkillRepositoryItem: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/admin/skill-repository/${id}/approve`, { method: 'POST', body: JSON.stringify({ reviewedBy: 'admin' }) });
    return normalizeSkillRepositoryItem(data);
  },
  rejectSkillRepositoryItem: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/admin/skill-repository/${id}/reject`, { method: 'POST', body: JSON.stringify({ reviewedBy: 'admin' }) });
    return normalizeSkillRepositoryItem(data);
  },
  archiveSkillRepositoryItem: async (id: string) => {
    const data = await request<Record<string, unknown>>(`/api/admin/skill-repository/${id}/archive`, { method: 'POST' });
    return normalizeSkillRepositoryItem(data);
  },

  getRagOverview: () => request<Record<string, unknown>>('/api/rag/overview'),
  listIndexedChunks: async () => {
    const data = await request<Array<Record<string, unknown>>>('/api/rag/indexed-chunks');
    return data.map(normalizeIndexedChunk);
  },
  updateIndexedChunkGovernance: async (id: string, payload: Partial<IndexedChunk>) => {
    const data = await request<Record<string, unknown>>(`/api/rag/chunks/${id}/governance`, { method: 'PUT', body: JSON.stringify(payload) });
    return normalizeIndexedChunk(data);
  },
  listRagAclPolicies: async () => {
    const data = await request<Array<Record<string, unknown>>>('/api/rag/acl-policies');
    return data.map(normalizeRagAclPolicy);
  },
  createRagAclPolicy: async (payload: Partial<RagAclPolicy>) => {
    const data = await request<Record<string, unknown>>('/api/rag/acl-policies', { method: 'POST', body: JSON.stringify(payload) });
    return normalizeRagAclPolicy(data);
  },
  updateRagAclPolicy: async (id: string, payload: Partial<RagAclPolicy>) => {
    const data = await request<Record<string, unknown>>(`/api/rag/acl-policies/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return normalizeRagAclPolicy(data);
  },
  listRagAclBindings: async () => {
    const data = await request<Array<Record<string, unknown>>>('/api/rag/acl-bindings');
    return data.map(normalizeRagAclBinding);
  },
  createRagAclBinding: async (payload: Partial<RagAclBinding>) => {
    const data = await request<Record<string, unknown>>('/api/rag/acl-bindings', { method: 'POST', body: JSON.stringify(payload) });
    return normalizeRagAclBinding(data);
  },
  deleteRagAclBinding: (id: string) => request<void>(`/api/rag/acl-bindings/${id}`, { method: 'DELETE' }),
  searchRetrieval: (payload: unknown) =>
    request<Record<string, unknown>>('/api/retrieval/debug', { method: 'POST', body: JSON.stringify(payload) }),
};
