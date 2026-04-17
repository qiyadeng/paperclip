export type IssueDetailTimelineOrder = "desc" | "asc";

export const ISSUE_DETAIL_TIMELINE_ORDER_STORAGE_KEY = "paperclip:issue-detail-timeline-order";

export function normalizeIssueDetailTimelineOrder(value: unknown): IssueDetailTimelineOrder {
  return value === "asc" || value === "desc" ? value : "desc";
}

export function readIssueDetailTimelineOrder(): IssueDetailTimelineOrder {
  try {
    return normalizeIssueDetailTimelineOrder(localStorage.getItem(ISSUE_DETAIL_TIMELINE_ORDER_STORAGE_KEY));
  } catch {
    return "desc";
  }
}

export function saveIssueDetailTimelineOrder(order: IssueDetailTimelineOrder) {
  try {
    localStorage.setItem(ISSUE_DETAIL_TIMELINE_ORDER_STORAGE_KEY, order);
  } catch {
    // Ignore localStorage failures.
  }
}
