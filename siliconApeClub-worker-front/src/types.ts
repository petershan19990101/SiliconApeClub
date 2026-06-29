export type PrincipalType = "external_customer" | "internal_user" | "admin" | "ai_employee";

export interface Principal {
  id: string;
  principalCode: string;
  displayName: string;
  principalType: PrincipalType;
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  roleTitle: string;
  orgUnitId?: string;
  orgUnitName?: string;
  positionCode?: string;
  description?: string;
  capabilities?: string[];
  canConsult?: boolean;
  canAssign?: boolean;
}

export interface DemandGroup {
  id: string;
  title: string;
  summary?: string;
  status: string;
  ownerPrincipalId: string;
  ownerName?: string;
  intakeEmployeeName?: string;
  assignedEmployeeName?: string;
  sessionCount?: number;
  taskCount?: number;
  sessions?: ConversationSession[];
  tasks?: WorkerTask[];
  artifacts?: Artifact[];
  updatedAt?: string;
}

export interface ConversationSession {
  id: string;
  demandGroupId: string;
  title: string;
  mode: string;
  primaryEmployeeId?: string;
  primaryEmployeeName?: string;
  messageCount?: number;
}

export interface WorkerMessage {
  id: string;
  demandGroupId: string;
  sessionId: string;
  senderType: "principal" | "ai_employee";
  senderId: string;
  senderName: string;
  blocks: MessageBlock[];
  createdAt: string;
}

export interface Capability {
  id: string;
  code: string;
  name: string;
  skillType: string;
  description?: string;
  groupCode?: string;
  groupName?: string;
  groupSort?: number;
  sortOrder?: number;
  transactionServiceCode?: string;
  formTitle: string;
  submitLabel: string;
  fields: FormField[];
  displayHtml?: string;
  defaultVisible?: boolean;
  deterministic?: boolean;
  externalVisible?: boolean;
  internalOnly?: boolean;
  actionCode?: string;
  keywords?: string[];
}

export type MessageBlock =
  | { type: "markdown"; content?: string; title?: string; data?: Record<string, unknown> }
  | { type: "html"; content?: string; title?: string; data?: Record<string, unknown> }
  | { type: "code"; content?: string; title?: string; data?: Record<string, unknown> }
  | { type: "image"; content?: string; title?: string; data?: Record<string, unknown> }
  | { type: "form"; content?: string; title?: string; data: FormBlockData }
  | { type: "artifact"; content?: string; title?: string; data: Record<string, unknown> }
  | { type: "task_status"; content?: string; title?: string; data: Record<string, unknown> }
  | { type: "org_route"; content?: string; title?: string; data: Record<string, unknown> }
  | { type: "employee_card"; content?: string; title?: string; data: Record<string, unknown> }
  | { type: "handoff"; content?: string; title?: string; data: Record<string, unknown> };

export interface FormBlockData {
  capabilityCode?: string;
  capabilityName?: string;
  transactionServiceCode?: string;
  actionCode?: string;
  htmlContent?: string;
  description?: string;
  deterministic?: boolean;
  submitted?: boolean;
  readOnly?: boolean;
  values?: Record<string, string>;
  submitLabel?: string;
  fields: FormField[];
}

export interface FormOption {
  label: string;
  value: string;
}

export interface FormField {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "date" | "email" | "tel";
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  options?: Array<string | FormOption>;
}

export interface WorkerTask {
  id: string;
  demandGroupId: string;
  sessionId?: string;
  title: string;
  description?: string;
  status: string;
  progress: number;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  assignedOrgUnitName?: string;
  checkpoint?: Record<string, unknown>;
  updatedAt?: string;
}

export interface Artifact {
  id: string;
  artifactType: string;
  title: string;
  uri: string;
}
