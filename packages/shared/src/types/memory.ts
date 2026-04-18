export type MemoryFileScopeType = "company" | "agent";

export interface MemoryFileSummary {
  path: string;
  size: number;
  language: string;
  markdown: boolean;
  editable: boolean;
}

export interface MemoryFileDetail extends MemoryFileSummary {
  content: string;
}

export interface MemoryFileBundle {
  scopeType: MemoryFileScopeType;
  scopeId: string;
  rootPath: string;
  editable: boolean;
  warnings: string[];
  files: MemoryFileSummary[];
}
