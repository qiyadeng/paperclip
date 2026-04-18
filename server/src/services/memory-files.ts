import fs from "node:fs/promises";
import path from "node:path";
import type { MemoryFileBundle, MemoryFileDetail, MemoryFileScopeType, MemoryFileSummary } from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";
import { resolveDefaultAgentWorkspaceDir, resolvePaperclipInstanceRoot } from "../home-paths.js";

const MAX_MEMORY_FILE_BYTES = 1_048_576;
const PATH_SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;
const IGNORED_FILE_NAMES = new Set([".DS_Store", "Thumbs.db", "Desktop.ini"]);
const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".qmd",
  ".nox",
  ".pytest_cache",
  ".ruff_cache",
  ".tox",
  ".venv",
  "__pycache__",
  "node_modules",
  "venv",
]);

type MemoryScope = {
  scopeType: MemoryFileScopeType;
  scopeId: string;
  rootPath: string;
};

type AgentLike = {
  id: string;
  companyId: string;
};

function safePathSegment(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed || !PATH_SEGMENT_RE.test(trimmed)) {
    throw unprocessable(`Invalid ${label} for memory path`);
  }
  return trimmed;
}

function normalizeRelativeFilePath(candidatePath: string): string {
  const normalized = path.posix.normalize(candidatePath.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw unprocessable("Memory file path must stay within the memory root");
  }
  return normalized;
}

function resolvePathWithinRoot(rootPath: string, relativePath: string): string {
  const normalizedRelativePath = normalizeRelativeFilePath(relativePath);
  const absoluteRoot = path.resolve(rootPath);
  const absolutePath = path.resolve(absoluteRoot, normalizedRelativePath);
  const relativeToRoot = path.relative(absoluteRoot, absolutePath);
  if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path.sep}`)) {
    throw unprocessable("Memory file path must stay within the memory root");
  }
  return absolutePath;
}

function inferLanguage(relativePath: string): string {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".toml")) return "toml";
  if (lower.endsWith(".txt")) return "text";
  if (lower.endsWith(".qmd")) return "markdown";
  return "text";
}

function isMarkdown(relativePath: string) {
  const lower = relativePath.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".qmd");
}

function shouldIgnoreMemoryEntry(entry: { name: string; isDirectory(): boolean; isFile(): boolean }) {
  if (entry.name === "." || entry.name === "..") return true;
  if (entry.isDirectory()) return IGNORED_DIRECTORY_NAMES.has(entry.name);
  if (!entry.isFile()) return false;
  return (
    IGNORED_FILE_NAMES.has(entry.name)
    || entry.name.startsWith("._")
    || entry.name.endsWith(".pyc")
    || entry.name.endsWith(".pyo")
  );
}

async function listFilesRecursive(rootPath: string): Promise<string[]> {
  const output: string[] = [];

  async function walk(currentPath: string, relativeDir: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (shouldIgnoreMemoryEntry(entry)) continue;
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = normalizeRelativeFilePath(
        relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name,
      );
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) continue;
      output.push(relativePath);
    }
  }

  await walk(rootPath, "");
  return output.sort((left, right) => left.localeCompare(right));
}

async function readFileSummary(rootPath: string, relativePath: string): Promise<MemoryFileSummary> {
  const normalizedPath = normalizeRelativeFilePath(relativePath);
  const absolutePath = resolvePathWithinRoot(rootPath, normalizedPath);
  const stat = await fs.stat(absolutePath);
  return {
    path: normalizedPath,
    size: stat.size,
    language: inferLanguage(normalizedPath),
    markdown: isMarkdown(normalizedPath),
    editable: stat.size <= MAX_MEMORY_FILE_BYTES,
  };
}

function toBundle(scope: MemoryScope, files: MemoryFileSummary[], warnings: string[] = []): MemoryFileBundle {
  return {
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
    rootPath: scope.rootPath,
    editable: true,
    warnings,
    files,
  };
}

function resolveCompanyMemoryRoot(companyId: string) {
  return path.resolve(
    resolvePaperclipInstanceRoot(),
    "companies",
    safePathSegment(companyId, "company id"),
    "memory",
  );
}

function resolveCompanyScope(companyId: string): MemoryScope {
  return {
    scopeType: "company",
    scopeId: companyId,
    rootPath: resolveCompanyMemoryRoot(companyId),
  };
}

function resolveAgentScope(agent: AgentLike): MemoryScope {
  return {
    scopeType: "agent",
    scopeId: agent.id,
    rootPath: resolveDefaultAgentWorkspaceDir(agent.id),
  };
}

export function memoryFileService() {
  async function getBundle(scope: MemoryScope): Promise<MemoryFileBundle> {
    await fs.mkdir(scope.rootPath, { recursive: true });
    const relativePaths = await listFilesRecursive(scope.rootPath);
    const summaries = await Promise.all(relativePaths.map((relativePath) => readFileSummary(scope.rootPath, relativePath)));
    return toBundle(scope, summaries);
  }

  async function readFile(scope: MemoryScope, relativePath: string): Promise<MemoryFileDetail> {
    await fs.mkdir(scope.rootPath, { recursive: true });
    const normalizedPath = normalizeRelativeFilePath(relativePath);
    const absolutePath = resolvePathWithinRoot(scope.rootPath, normalizedPath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) throw notFound("Memory file not found");
    if (stat.size > MAX_MEMORY_FILE_BYTES) {
      throw unprocessable("Memory file is too large to edit in the browser");
    }
    const content = await fs.readFile(absolutePath, "utf8");
    return {
      path: normalizedPath,
      size: stat.size,
      language: inferLanguage(normalizedPath),
      markdown: isMarkdown(normalizedPath),
      editable: true,
      content,
    };
  }

  async function writeFile(scope: MemoryScope, relativePath: string, content: string): Promise<MemoryFileDetail> {
    if (Buffer.byteLength(content, "utf8") > MAX_MEMORY_FILE_BYTES) {
      throw unprocessable("Memory file content is too large");
    }
    await fs.mkdir(scope.rootPath, { recursive: true });
    const normalizedPath = normalizeRelativeFilePath(relativePath);
    const absolutePath = resolvePathWithinRoot(scope.rootPath, normalizedPath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");
    return readFile(scope, normalizedPath);
  }

  return {
    resolveCompanyScope,
    resolveAgentScope,
    getCompanyBundle: (companyId: string) => getBundle(resolveCompanyScope(companyId)),
    readCompanyFile: (companyId: string, relativePath: string) => readFile(resolveCompanyScope(companyId), relativePath),
    writeCompanyFile: (companyId: string, relativePath: string, content: string) => writeFile(resolveCompanyScope(companyId), relativePath, content),
    getAgentBundle: (agent: AgentLike) => getBundle(resolveAgentScope(agent)),
    readAgentFile: (agent: AgentLike, relativePath: string) => readFile(resolveAgentScope(agent), relativePath),
    writeAgentFile: (agent: AgentLike, relativePath: string, content: string) => writeFile(resolveAgentScope(agent), relativePath, content),
  };
}
