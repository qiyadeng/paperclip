import { Link } from "@/lib/router";
import type { Issue, IssueRelationIssueSummary } from "@paperclipai/shared";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityIcon } from "./PriorityIcon";
import { StatusIcon } from "./StatusIcon";
import { createIssueDetailPath } from "../lib/issueDetailBreadcrumb";

export type IssueRelationLinkState = unknown;

type RelationIssue = Pick<IssueRelationIssueSummary, "id" | "identifier" | "title"> & {
  status?: Issue["status"] | string;
  priority?: Issue["priority"] | string;
};

type IssueRelationsSectionProps = {
  issue: Issue;
  childIssues: Issue[];
  childIssuesLoading?: boolean;
  issueLinkState?: IssueRelationLinkState;
  onAddSubIssue?: () => void;
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

function RelationGroup({
  title,
  issues,
  emptyText,
  issueLinkState,
}: {
  title: string;
  issues: RelationIssue[];
  emptyText?: string;
  issueLinkState?: IssueRelationLinkState;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
        {issues.length > 0 ? <span className="text-[11px] text-muted-foreground">{issues.length}</span> : null}
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
  onAddSubIssue,
}: IssueRelationsSectionProps) {
  const parentIssue = parentIssueFromAncestors(issue);
  const blockedBy = issue.blockedBy ?? [];
  const blocking = issue.blocks ?? [];

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
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sub-issues</h4>
            {childIssues.length > 0 ? <span className="text-[11px] text-muted-foreground">{childIssues.length}</span> : null}
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
