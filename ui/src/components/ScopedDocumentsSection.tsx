import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { ScopedDocument } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownBody } from "./MarkdownBody";
import { MarkdownEditor } from "./MarkdownEditor";
import { cn, relativeTime } from "../lib/utils";
import { Check, Copy, FilePenLine, FileText, Plus, Trash2, X } from "lucide-react";

type DraftState = {
  key: string;
  title: string;
  body: string;
  baseRevisionId: string | null;
  isNew: boolean;
};

const DOCUMENT_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

type ScopedDocumentsSectionProps = {
  title: string;
  description?: string;
  documentsQueryKey: QueryKey;
  loadDocuments: () => Promise<ScopedDocument[]>;
  saveDocument: (key: string, data: {
    title?: string | null;
    format: "markdown";
    body: string;
    changeSummary?: string | null;
    baseRevisionId?: string | null;
  }) => Promise<ScopedDocument>;
  deleteDocument?: (key: string) => Promise<ScopedDocument>;
  emptyLabel?: string;
  className?: string;
};

export function ScopedDocumentsSection({
  title,
  description,
  documentsQueryKey,
  loadDocuments,
  saveDocument,
  deleteDocument,
  emptyLabel = "No documents yet.",
  className,
}: ScopedDocumentsSectionProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const { data: documents, isLoading, error: loadError } = useQuery({
    queryKey: documentsQueryKey,
    queryFn: loadDocuments,
  });

  const sortedDocuments = useMemo(() => {
    return [...(documents ?? [])].sort((left, right) => {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [documents]);

  const saveMutation = useMutation({
    mutationFn: async (currentDraft: DraftState) => {
      const key = currentDraft.key.trim().toLowerCase();
      return saveDocument(key, {
        title: currentDraft.title.trim() || null,
        format: "markdown",
        body: currentDraft.body,
        baseRevisionId: currentDraft.baseRevisionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      setDraft(null);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save document");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      if (!deleteDocument) throw new Error("Delete is not available");
      return deleteDocument(key);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      setConfirmDeleteKey(null);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    },
  });

  const beginNewDocument = () => {
    setDraft({ key: "", title: "", body: "", baseRevisionId: null, isNew: true });
    setError(null);
  };

  const beginEdit = (doc: ScopedDocument) => {
    setDraft({
      key: doc.key,
      title: doc.title ?? "",
      body: doc.body,
      baseRevisionId: doc.latestRevisionId,
      isNew: false,
    });
    setError(null);
  };

  const commitDraft = () => {
    if (!draft) return;
    const key = draft.key.trim().toLowerCase();
    if (!key || !DOCUMENT_KEY_PATTERN.test(key)) {
      setError("Document key must start with a letter or number and use only lowercase letters, numbers, -, or _.");
      return;
    }
    if (!draft.body.trim()) {
      setError("Document body cannot be empty.");
      return;
    }
    saveMutation.mutate({ ...draft, key });
  };

  const copyDocumentBody = async (key: string, body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1200);
    } catch {
      setError("Could not copy document");
    }
  };

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={beginNewDocument}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New document
        </Button>
      </div>

      {loadError ? <p className="text-sm text-destructive">{loadError instanceof Error ? loadError.message : "Unable to load documents"}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {draft ? (
        <div className="space-y-3 rounded-lg border border-border bg-accent/10 p-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <Input
              value={draft.key}
              disabled={!draft.isNew}
              onChange={(event) => setDraft((current) => current ? { ...current, key: event.target.value.toLowerCase() } : current)}
              placeholder="document-key"
            />
            <Input
              value={draft.title}
              onChange={(event) => setDraft((current) => current ? { ...current, title: event.target.value } : current)}
              placeholder="Optional title"
            />
          </div>
          <MarkdownEditor
            value={draft.body}
            onChange={(body) => setDraft((current) => current ? { ...current, body } : current)}
            placeholder="Markdown body"
            bordered={false}
            className="bg-transparent"
            contentClassName="min-h-[220px] text-[15px] leading-7"
            onSubmit={commitDraft}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={commitDraft} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : draft.isNew ? "Create document" : "Save document"}
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading documents...</p> : null}
      {!isLoading && sortedDocuments.length === 0 && !draft ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : null}

      <div className="space-y-3">
        {sortedDocuments.map((doc) => (
          <article key={doc.key} id={`document-${doc.key}`} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {doc.key}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    rev {doc.latestRevisionNumber} • updated {relativeTime(doc.updatedAt)}
                  </span>
                </div>
                {doc.title ? <h4 className="text-sm font-medium">{doc.title}</h4> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title={copiedKey === doc.key ? "Copied" : "Copy document"}
                  onClick={() => void copyDocumentBody(doc.key, doc.body)}
                >
                  {copiedKey === doc.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon-xs" title="Edit document" onClick={() => beginEdit(doc)}>
                  <FilePenLine className="h-3.5 w-3.5" />
                </Button>
                {deleteDocument ? (
                  confirmDeleteKey === doc.key ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(doc.key)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete?
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon-xs" title="Delete document" onClick={() => setConfirmDeleteKey(doc.key)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )
                ) : null}
              </div>
            </div>
            <div className="paperclip-edit-in-place-content mt-3 min-h-[80px] text-[15px] leading-7">
              <MarkdownBody>{doc.body}</MarkdownBody>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
