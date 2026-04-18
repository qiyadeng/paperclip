import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MemoryFileBundle, MemoryFileDetail } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { MarkdownEditor } from "./MarkdownEditor";
import { PackageFileTree, buildFileTree } from "./PackageFileTree";
import { cn } from "../lib/utils";

type MemoryFileEditorProps = {
  title: string;
  description: string;
  defaultFilePath: string;
  newFilePlaceholder?: string;
  bundleQueryKey: readonly unknown[];
  fileQueryKey: (path: string) => readonly unknown[];
  loadBundle: () => Promise<MemoryFileBundle>;
  loadFile: (path: string) => Promise<MemoryFileDetail>;
  saveFile: (data: { path: string; content: string }) => Promise<MemoryFileDetail>;
  className?: string;
};

function isMarkdownFile(path: string) {
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".qmd");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}b`;
  return `${(bytes / 1024).toFixed(1)}kb`;
}

function expandParentDirectories(paths: string[]) {
  const next = new Set<string>();
  for (const filePath of paths) {
    const parts = filePath.split("/");
    let current = "";
    for (let i = 0; i < parts.length - 1; i += 1) {
      current = current ? `${current}/${parts[i]}` : parts[i] ?? "";
      if (current) next.add(current);
    }
  }
  return next;
}

export function MemoryFileEditor({
  title,
  description,
  defaultFilePath,
  newFilePlaceholder = "memory/YYYY-MM-DD.md",
  bundleQueryKey,
  fileQueryKey,
  loadBundle,
  loadFile,
  saveFile,
  className,
}: MemoryFileEditorProps) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState(defaultFilePath);
  const [draft, setDraft] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [newFilePath, setNewFilePath] = useState("");
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const { data: bundle, isLoading: bundleLoading, error: bundleError } = useQuery({
    queryKey: bundleQueryKey,
    queryFn: loadBundle,
  });

  const fileOptions = useMemo(() => bundle?.files.map((file) => file.path) ?? [], [bundle]);
  const visibleFilePaths = useMemo(
    () => [...new Set([...fileOptions, ...pendingFiles, selectedFile || defaultFilePath])],
    [defaultFilePath, fileOptions, pendingFiles, selectedFile],
  );
  const selectedFileExists = fileOptions.includes(selectedFile);
  const selectedFileSummary = bundle?.files.find((file) => file.path === selectedFile) ?? null;
  const fileTree = useMemo(
    () => buildFileTree(Object.fromEntries(visibleFilePaths.map((filePath) => [filePath, ""]))),
    [visibleFilePaths],
  );

  const { data: selectedFileDetail, isLoading: fileLoading, error: fileError } = useQuery({
    queryKey: fileQueryKey(selectedFile),
    queryFn: () => loadFile(selectedFile),
    enabled: selectedFileExists && selectedFileSummary?.editable !== false,
  });

  useEffect(() => {
    setSelectedFile(defaultFilePath);
    setDraft(null);
    setPendingFiles([]);
    setNewFilePath("");
    setShowNewFileInput(false);
    setSavedPath(null);
  }, [defaultFilePath]);

  useEffect(() => {
    setExpandedDirs(expandParentDirectories(visibleFilePaths));
  }, [visibleFilePaths]);

  useEffect(() => {
    if (!bundle || selectedFileExists || pendingFiles.includes(selectedFile)) return;
    if (fileOptions.includes(defaultFilePath)) {
      setSelectedFile(defaultFilePath);
      return;
    }
    if (fileOptions.length > 0) {
      setSelectedFile(fileOptions[0]!);
    }
  }, [bundle, defaultFilePath, fileOptions, pendingFiles, selectedFile, selectedFileExists]);

  const displayValue = draft ?? selectedFileDetail?.content ?? "";
  const savedValue = selectedFileExists ? selectedFileDetail?.content ?? "" : "";
  const dirty = draft !== null && draft !== savedValue;

  const saveMutation = useMutation({
    mutationFn: saveFile,
    onSuccess: (file) => {
      setDraft(null);
      setSavedPath(file.path);
      setPendingFiles((current) => current.filter((path) => path !== file.path));
      queryClient.setQueryData(fileQueryKey(file.path), file);
      void queryClient.invalidateQueries({ queryKey: bundleQueryKey });
      void queryClient.invalidateQueries({ queryKey: fileQueryKey(file.path) });
      window.setTimeout(() => setSavedPath((current) => (current === file.path ? null : current)), 2000);
    },
  });

  const selectFile = (filePath: string) => {
    if (filePath === selectedFile) return;
    if (dirty && !window.confirm("Discard unsaved memory edits?")) return;
    setSelectedFile(filePath);
    setDraft(pendingFiles.includes(filePath) ? "" : null);
    setSavedPath(null);
  };

  const createPendingFile = () => {
    const candidate = newFilePath.trim();
    if (!candidate || candidate.includes("..")) return;
    if (!visibleFilePaths.includes(candidate)) {
      setPendingFiles((current) => [...current, candidate]);
    }
    setSelectedFile(candidate);
    setDraft("");
    setNewFilePath("");
    setShowNewFileInput(false);
  };

  if (bundleLoading && !bundle) {
    return (
      <div className={cn("space-y-3 rounded-md border border-border px-4 py-4", className)}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 rounded-md border border-border px-4 py-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          {bundle?.rootPath ? (
            <p className="font-mono text-[11px] text-muted-foreground/80 break-all">{bundle.rootPath}</p>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowNewFileInput((open) => !open)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New file
        </Button>
      </div>

      {bundleError ? (
        <p className="text-sm text-destructive">
          {bundleError instanceof Error ? bundleError.message : "Unable to load memory files"}
        </p>
      ) : null}

      {bundle?.warnings.length ? (
        <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {bundle.warnings.map((warning) => <div key={warning}>{warning}</div>)}
        </div>
      ) : null}

      {showNewFileInput ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3 sm:flex-row">
          <Input
            value={newFilePath}
            onChange={(event) => setNewFilePath(event.target.value)}
            placeholder={newFilePlaceholder}
            className="font-mono text-sm"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") createPendingFile();
              if (event.key === "Escape") {
                setShowNewFileInput(false);
                setNewFilePath("");
              }
            }}
          />
          <Button type="button" size="sm" onClick={createPendingFile} disabled={!newFilePath.trim() || newFilePath.includes("..")}>
            Create
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewFileInput(false); setNewFilePath(""); }}>
            Cancel
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-md border border-border bg-muted/10 py-2">
          {visibleFilePaths.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No memory files yet. Create one to start.</p>
          ) : (
            <PackageFileTree
              nodes={fileTree}
              selectedFile={selectedFile}
              expandedDirs={expandedDirs}
              checkedFiles={new Set()}
              onToggleDir={(dirPath) => setExpandedDirs((current) => {
                const next = new Set(current);
                if (next.has(dirPath)) next.delete(dirPath);
                else next.add(dirPath);
                return next;
              })}
              onSelectFile={selectFile}
              onToggleCheck={() => {}}
              showCheckboxes={false}
              renderFileExtra={(node) => {
                const file = bundle?.files.find((entry) => entry.path === node.path);
                if (!file) {
                  return <span className="ml-2 shrink-0 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">new</span>;
                }
                return <span className="ml-2 shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{formatBytes(file.size)}</span>;
              }}
            />
          )}
        </div>

        <div className="min-w-0 space-y-3 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate font-mono text-sm font-medium">{selectedFile}</h4>
              <p className="text-xs text-muted-foreground">
                {selectedFileExists
                  ? selectedFileSummary?.editable === false
                    ? "Too large to edit in browser"
                    : `${selectedFileDetail?.language ?? selectedFileSummary?.language ?? "text"} file`
                  : "New memory file"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savedPath === selectedFile ? <span className="text-xs text-muted-foreground">Saved</span> : null}
              <Button
                type="button"
                size="sm"
                disabled={!dirty || saveMutation.isPending || selectedFileSummary?.editable === false}
                onClick={() => saveMutation.mutate({ path: selectedFile, content: displayValue })}
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {fileError ? (
            <p className="text-sm text-destructive">{fileError instanceof Error ? fileError.message : "Unable to load file"}</p>
          ) : null}
          {saveMutation.isError ? (
            <p className="text-sm text-destructive">
              {saveMutation.error instanceof Error ? saveMutation.error.message : "Unable to save memory file"}
            </p>
          ) : null}

          {selectedFileExists && fileLoading && !selectedFileDetail ? (
            <Skeleton className="h-[420px] w-full" />
          ) : selectedFileSummary?.editable === false ? (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-6 text-sm text-muted-foreground">
              This file is larger than the browser editor limit.
            </div>
          ) : isMarkdownFile(selectedFile) ? (
            <MarkdownEditor
              key={selectedFile}
              value={displayValue}
              onChange={(value) => setDraft(value ?? "")}
              placeholder="# Memory"
              contentClassName="min-h-[420px] text-sm font-mono"
            />
          ) : (
            <textarea
              value={displayValue}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-[420px] w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm outline-none"
              placeholder="Memory file contents"
            />
          )}
        </div>
      </div>
    </div>
  );
}
