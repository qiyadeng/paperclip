import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@/lib/router";
import type { Issue, IssueRelationIssueSummary } from "@paperclipai/shared";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityIcon } from "./PriorityIcon";
import { StatusIcon } from "./StatusIcon";
import { createIssueDetailPath } from "../lib/issueDetailBreadcrumb";
import { cn } from "../lib/utils";

export type IssueRelationLinkState = unknown;

type RelationIssue = Pick<IssueRelationIssueSummary, "id" | "identifier" | "title"> & {
  status?: Issue["status"] | string;
  priority?: Issue["priority"] | string;
  parentId?: string | null;
};

type IssueRelationsSectionProps = {
  issue: Issue;
  childIssues: Issue[];
  childIssuesLoading?: boolean;
  issueLinkState?: IssueRelationLinkState;
  allIssues?: Issue[];
  relationUpdatePending?: boolean;
  onAddSubIssue?: () => void;
  onSetParentIssue?: (parentIssueId: string | null) => void;
  onLinkExistingSubIssue?: (childIssueId: string) => void;
};

function relationIssuePath(issue: RelationIssue) {
  return createIssueDetailPath(issue.identifier ?? issue.id);
}

function parentIssueFromAncestors(issue: Issue): RelationIssue | null {
  const parent = issue.ancestors?.[0];
  if (parent) {
    return {
      id: parent.id,
      identifier: parent.identifier,
      title: parent.title,
      status: parent.status,
      priority: parent.priority,
    };
  }
  if (!issue.parentId) return null;
  return {
    id: issue.parentId,
    identifier: null,
    title: issue.parentId.slice(0, 8),
  };
}

function issueSearchText(issue: RelationIssue) {
  return `${issue.identifier ?? ""} ${issue.title}`.trim().toLowerCase();
}

function filterAndSortIssues(issues: RelationIssue[], search: string) {
  const query = search.trim().toLowerCase();
  return issues
    .filter((issue) => !query || issueSearchText(issue).includes(query))
    .sort((a, b) => issueSearchText(a).localeCompare(issueSearchText(b)));
}

function buildDescendantIssueIds(allIssues: readonly Issue[] | undefined, issueId: string) {
  const childrenByParentId = new Map<string, string[]>();
  for (const candidate of allIssues ?? []) {
    if (!candidate.parentId) continue;
    const children = childrenByParentId.get(candidate.parentId) ?? [];
    children.push(candidate.id);
    childrenByParentId.set(candidate.parentId, children);
  }

  const descendants = new Set<string>();
  const stack = [...(childrenByParentId.get(issueId) ?? [])];
  while (stack.length > 0) {
    const candidateId = stack.pop();
    if (!candidateId || descendants.has(candidateId)) continue;
    descendants.add(candidateId);
    stack.push(...(childrenByParentId.get(candidateId) ?? []));
  }
  return descendants;
}

function IssueRelationRow({ issue, issueLinkState }: { issue: RelationIssue; issueLinkState?: IssueRelationLinkState }) {
  return (
    <Link
      to={relationIssuePath(issue)}
      state={issueLinkState}
      className="group flex min-w-0 items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm transition-colors hover:bg-accent/50"
      title={issue.title}
    >
      {issue.status ? <StatusIcon status={issue.status} /> : null}
      {issue.priority ? <PriorityIcon priority={issue.priority} /> : null}
      <span className="font-mono text-[11px] text-muted-foreground shrink-0">
        {issue.identifier ?? issue.id.slice(0, 8)}
      </span>
      <span className="truncate group-hover:text-foreground">{issue.title}</span>
    </Link>
  );
}

function IssuePickerRow({
  issue,
  selected,
  disabled,
  onClick,
}: {
  issue: RelationIssue;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
        selected && "bg-accent",
      )}
      onClick={onClick}
    >
      {issue.status ? <StatusIcon status={issue.status} /> : null}
      <span className="min-w-0 truncate">
        {issue.identifier ? `${issue.identifier} ` : ""}
        {issue.title}
      </span>
    </button>
  );
}

function RelationGroup({
  title,
  issues,
  emptyText,
  issueLinkState,
  action,
}: {
  title: string;
  issues: RelationIssue[];
  emptyText?: string;
  issueLinkState?: IssueRelationLinkState;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
          {issues.length > 0 ? <span className="text-[11px] text-muted-foreground">{issues.length}</span> : null}
        </div>
        {action}
      </div>
      {issues.length > 0 ? (
        <div className="space-y-1.5">
          {issues.map((issue) => (
            <IssueRelationRow key={issue.id} issue={issue} issueLinkState={issueLinkState} />
          ))}
        </div>
      ) : emptyText ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : null}
    </div>
  );
}

export function IssueRelationsSection({
  issue,
  childIssues,
  childIssuesLoading = false,
  issueLinkState,
  allIssues,
  relationUpdatePending = false,
  onAddSubIssue,
  onSetParentIssue,
  onLinkExistingSubIssue,
}: IssueRelationsSectionProps) {
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [parentSearch, setParentSearch] = useState("");
  const [subIssuePickerOpen, setSubIssuePickerOpen] = useState(false);
  const [subIssueSearch, setSubIssueSearch] = useState("");
  const parentIssue = parentIssueFromAncestors(issue);
  const blockedBy = issue.blockedBy ?? [];
  const blocking = issue.blocks ?? [];
  const childIssueIds = useMemo(() => new Set(childIssues.map((child) => child.id)), [childIssues]);
  const ancestorIssueIds = useMemo(() => new Set((issue.ancestors ?? []).map((ancestor) => ancestor.id)), [issue.ancestors]);
  const descendantIssueIds = useMemo(() => buildDescendantIssueIds(allIssues, issue.id), [allIssues, issue.id]);
  const parentOptions = useMemo(
    () => filterAndSortIssues(
      (allIssues ?? []).filter((candidate) => candidate.id !== issue.id && !descendantIssueIds.has(candidate.id)),
      parentSearch,
    ),
    [allIssues, descendantIssueIds, issue.id, parentSearch],
  );
  const subIssueOptions = useMemo(
    () => filterAndSortIssues(
      (allIssues ?? []).filter((candidate) => (
        candidate.id !== issue.id
        && !childIssueIds.has(candidate.id)
        && candidate.parentId !== issue.id
        && !ancestorIssueIds.has(candidate.id)
      )),
      subIssueSearch,
    ),
    [allIssues, ancestorIssueIds, childIssueIds, issue.id, subIssueSearch],
  );

  const parentPicker = onSetParentIssue ? (
    <Popover open={parentPickerOpen} onOpenChange={(open) => { setParentPickerOpen(open); if (!open) setParentSearch(""); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" disabled={relationUpdatePending}>
          {issue.parentId ? "Change" : "Set"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <input
          className="mb-1 w-full border-b border-border bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50"
          placeholder="Search issues..."
          value={parentSearch}
          onChange={(event) => setParentSearch(event.target.value)}
          autoFocus
        />
        <div className="max-h-56 overflow-y-auto overscroll-contain">
          <button
            type="button"
            disabled={relationUpdatePending}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
              !issue.parentId && "bg-accent",
            )}
            onClick={() => {
              onSetParentIssue(null);
              setParentPickerOpen(false);
            }}
          >
            No parent
          </button>
          {parentOptions.length > 0 ? parentOptions.map((candidate) => (
            <IssuePickerRow
              key={candidate.id}
              issue={candidate}
              selected={candidate.id === issue.parentId}
              disabled={relationUpdatePending}
              onClick={() => {
                onSetParentIssue(candidate.id);
                setParentPickerOpen(false);
              }}
            />
          )) : (
            <p className="px-2 py-2 text-xs text-muted-foreground">No matching issues.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  ) : null;

  const linkExistingSubIssuePicker = onLinkExistingSubIssue ? (
    <Popover open={subIssuePickerOpen} onOpenChange={(open) => { setSubIssuePickerOpen(open); if (!open) setSubIssueSearch(""); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" disabled={relationUpdatePending}>
          Link existing
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <input
          className="mb-1 w-full border-b border-border bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50"
          placeholder="Search issues..."
          value={subIssueSearch}
          onChange={(event) => setSubIssueSearch(event.target.value)}
          autoFocus
        />
        <div className="max-h-56 overflow-y-auto overscroll-contain">
          {subIssueOptions.length > 0 ? subIssueOptions.map((candidate) => (
            <IssuePickerRow
              key={candidate.id}
              issue={candidate}
              disabled={relationUpdatePending}
              onClick={() => {
                onLinkExistingSubIssue(candidate.id);
                setSubIssuePickerOpen(false);
              }}
            />
          )) : (
            <p className="px-2 py-2 text-xs text-muted-foreground">No matching issues.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  ) : null;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Issue links</h3>
        </div>
        {onAddSubIssue ? (
          <Button variant="outline" size="sm" onClick={onAddSubIssue} className="h-8 shrink-0 shadow-none">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Sub-issue
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <RelationGroup
          title="Parent"
          issues={parentIssue ? [parentIssue] : []}
          emptyText="No parent issue."
          issueLinkState={issueLinkState}
          action={parentPicker}
        />
        <RelationGroup
          title="Blocked by"
          issues={blockedBy}
          emptyText="No blockers."
          issueLinkState={issueLinkState}
        />
        <RelationGroup
          title="Blocking"
          issues={blocking}
          emptyText="This issue is not blocking other issues."
          issueLinkState={issueLinkState}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sub-issues</h4>
              {childIssues.length > 0 ? <span className="text-[11px] text-muted-foreground">{childIssues.length}</span> : null}
            </div>
            {linkExistingSubIssuePicker}
          </div>
          {childIssuesLoading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-4/5" />
            </div>
          ) : childIssues.length > 0 ? (
            <div className="space-y-1.5">
              {childIssues.map((child) => (
                <IssueRelationRow key={child.id} issue={child} issueLinkState={issueLinkState} />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              No sub-issues yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
