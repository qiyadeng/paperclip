// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import type { Issue } from "@paperclipai/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IssueRelationsSection } from "./IssueRelationsSection";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}));

function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    identifier: "PAP-1",
    companyId: "company-1",
    projectId: null,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Issue title",
    description: null,
    status: "todo",
    priority: "medium",
    assigneeAgentId: null,
    assigneeUserId: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: 1,
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date("2026-04-07T00:00:00.000Z"),
    updatedAt: new Date("2026-04-07T00:00:00.000Z"),
    labels: [],
    labelIds: [],
    myLastTouchAt: null,
    lastExternalCommentAt: null,
    lastActivityAt: null,
    isUnreadForMe: false,
    ...overrides,
  } as Issue;
}

describe("IssueRelationsSection", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
  });

  it("renders parent, blockers, blocking issues, and sub-issues as links", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const issue = createIssue({
      ancestors: [{
        id: "parent-1",
        identifier: "PAP-10",
        title: "Parent issue",
        description: null,
        status: "todo",
        priority: "high",
        assigneeAgentId: null,
        assigneeUserId: null,
        projectId: null,
        goalId: null,
        project: null,
        goal: null,
      }],
      blockedBy: [{
        id: "blocker-1",
        identifier: "PAP-11",
        title: "Blocking dependency",
        status: "blocked",
        priority: "critical",
        assigneeAgentId: null,
        assigneeUserId: null,
      }],
      blocks: [{
        id: "blocked-1",
        identifier: "PAP-12",
        title: "Downstream issue",
        status: "todo",
        priority: "medium",
        assigneeAgentId: null,
        assigneeUserId: null,
      }],
    });
    const childIssue = createIssue({ id: "child-1", identifier: "PAP-13", title: "Child issue" });

    act(() => {
      root.render(<IssueRelationsSection issue={issue} childIssues={[childIssue]} onAddSubIssue={() => undefined} />);
    });

    expect(container.textContent).toContain("Issue links");
    expect(container.textContent).toContain("Parent issue");
    expect(container.textContent).toContain("Blocking dependency");
    expect(container.textContent).toContain("Downstream issue");
    expect(container.textContent).toContain("Child issue");
    expect(Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"))).toEqual([
      "/issues/PAP-10",
      "/issues/PAP-11",
      "/issues/PAP-12",
      "/issues/PAP-13",
    ]);

    act(() => root.unmount());
  });
});
