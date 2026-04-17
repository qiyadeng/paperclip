// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  ISSUE_DETAIL_TIMELINE_ORDER_STORAGE_KEY,
  readIssueDetailTimelineOrder,
  saveIssueDetailTimelineOrder,
} from "./issue-detail-timeline-order";

describe("issue detail timeline order preference", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to newest first", () => {
    expect(readIssueDetailTimelineOrder()).toBe("desc");
  });

  it("persists valid timeline order values", () => {
    saveIssueDetailTimelineOrder("asc");
    expect(localStorage.getItem(ISSUE_DETAIL_TIMELINE_ORDER_STORAGE_KEY)).toBe("asc");
    expect(readIssueDetailTimelineOrder()).toBe("asc");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem(ISSUE_DETAIL_TIMELINE_ORDER_STORAGE_KEY, "sideways");
    expect(readIssueDetailTimelineOrder()).toBe("desc");
  });
});
