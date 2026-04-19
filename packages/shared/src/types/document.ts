import type { DocumentFormat } from "./issue.js";

export type DocumentScopeType = "company" | "project" | "issue";

export interface ScopedDocumentSummary {
  id: string;
  companyId: string;
  scopeType: DocumentScopeType;
  scopeId: string;
  key: string;
  title: string | null;
  format: DocumentFormat;
  latestRevisionId: string | null;
  latestRevisionNumber: number;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScopedDocument extends ScopedDocumentSummary {
  body: string;
}

export interface ScopedDocumentRevision {
  id: string;
  companyId: string;
  documentId: string;
  scopeType: DocumentScopeType;
  scopeId: string;
  key: string;
  revisionNumber: number;
  title: string | null;
  format: DocumentFormat;
  body: string;
  changeSummary: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}
