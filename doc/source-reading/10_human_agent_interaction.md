# 10 人类与 Agent 的交互机制

## 结论

Paperclip 当前明确采用：

```text
Tasks + comments only，没有独立 chat 系统
```

源码依据：`doc/SPEC-implementation.md` 中 V1 决策写明：

```text
Communication | Tasks + comments only (no separate chat system)
```

所以，人类与 Agent 的沟通默认应该围绕：

```text
Issue
Issue Comment
Approval
Issue status / assignee
```

而不是另建一个自由聊天会话。

## 人类在哪里和 Agent 沟通

### 1. Issue Detail 页面评论区

主要入口：

```text
ui/src/pages/IssueDetail.tsx
ui/src/components/IssueChatThread.tsx
server/src/routes/issues.ts
```

人类在某个 issue 下发表评论，系统会：

1. 写入 `issue_comments`。
2. 写入 `activity_log`：`issue.comment_added`。
3. 如果该 issue 有 assignee agent，通常会 wake assignee。
4. 如果评论中 @mention 了其他 agent，会 wake 被提到的 agent。

适用场景：

- 澄清需求。
- 回答 Agent 提问。
- 让 Agent 改方向。
- 给 review feedback。
- 要求补充信息。
- 让 Agent 继续执行。

### 2. Approvals 页面 / Approval 详情页

主要入口：

```text
ui/src/pages/Approvals.tsx
ui/src/pages/ApprovalDetail.tsx
server/src/routes/approvals.ts
server/src/services/approvals.ts
```

适用场景：

- hire agent。
- approve CEO strategy。
- budget override。
- request board approval。
- 其他正式治理动作。

Approval 支持：

```text
approve
reject
request-revision
resubmit
comments
linked issues
```

人类 approve 后，如果 approval 有 `requestedByAgentId`，系统会 wake 请求的 agent，reason 例如：

```text
approval_approved
```

### 3. Inbox / Dashboard

人类可以通过 Board UI 的 inbox、dashboard、sidebar badges 找到需要处理的 issue/comment/approval。

这些不是新的沟通模型，而是入口和聚合视图。

## Agent 发现问题需要人类确认时，通常怎么做

推荐流程：

```text
Agent 执行 issue
→ 发现需要人类确认
→ 在当前 issue 下写清楚问题/选项/推荐方案
→ 把 issue 状态改为 blocked 或 in_review
→ 必要时把 assigneeUserId 指向 human/board 用户
→ 人类在同一个 issue 评论回复或做 approval decision
→ 评论会 wake agent 继续执行
```

## 推荐使用现有 Issue 评论，而不是新建 Issue 的情况

优先在当前 issue 下评论：

- 这是当前任务范围内的问题。
- 只是需求澄清。
- 需要人类在几个方案中选一个。
- 需要 review feedback。
- Agent 被 blocker 卡住，等待人类回答。
- 人类要补充上下文或纠正方向。

示例 Agent 评论：

```md
## Need board confirmation

I am blocked on one product decision before continuing.

Question:
Should the onboarding flow optimize for:

A. Fast local trusted setup with no login
B. Authenticated private setup by default

Recommendation:
Choose A for first-run experience, and expose B as an advanced option.

Impact:
- A reduces time-to-first-success
- B is safer for shared/private deployments

Please confirm A or B. I will continue after confirmation.
```

建议状态：

```text
blocked
```

如果是等待 review：

```text
in_review
```

## 应该新建 Issue 的情况

新建 issue/sub-issue 适合：

- 发现了一个独立的新工作项。
- 当前任务不应该扩大范围。
- 需要另一个 agent 并行处理。
- 发现 bug，但当前 issue 是 feature 实现。
- 需要 QA 单独验证。
- 需要设计/文案/营销协作。
- 需要形成可追踪的后续任务。

建议创建 sub-issue 而不是散落评论：

```text
parentId = 当前 issue id
goalId = 当前 goal id
assigneeAgentId = 对应 agent
status = todo
```

示例：

```md
Title: QA verify onboarding authenticated mode

Description:
Parent issue implemented onboarding mode selection. Please verify authenticated/private mode works end-to-end.

Acceptance criteria:
- Can create first admin invite
- Can sign in
- Can create company
- Can create CEO agent
- No unauthenticated access to board routes
```

## 应该创建 Approval 的情况

如果是正式治理决策，不建议只靠普通 comment，应该创建 approval。

适合 Approval：

- 招聘新 Agent。
- CEO strategy 需要 board approve。
- 超预算或预算 override。
- 高风险操作需要 board approval。
- 需要明确 approve/reject/revision 的决策记录。

Approval 可以关联 issue，形成：

```text
Issue 上说明为什么需要 approval
Approval 上记录正式决策
Approval 通过后 wake 请求 agent
```

## 状态建议

| 场景 | 推荐方式 | 推荐 status |
|---|---|---|
| 需求澄清 | 当前 issue comment | `blocked` |
| 等人类 review | 当前 issue comment | `in_review` |
| 人类要求修改 | 当前 issue comment | `in_progress` 或 `todo` |
| 新发现独立工作 | 新建 sub-issue | `todo` |
| 需要另一个 Agent 协作 | 新建 sub-issue 并 assign | `todo` |
| 正式治理确认 | Approval + linked issue | approval pending |
| 小范围方向选择 | 当前 issue comment | `blocked` |
| 高风险/预算/招聘 | Approval | approval pending |

## 人类回复后怎么继续

人类在 issue 下评论后，后端会触发 wakeup：

```text
reason: issue_commented
```

如果评论 @mention 了 agent：

```text
reason: issue_comment_mentioned
```

Agent 下次 heartbeat 会从 wake context 里看到：

- `PAPERCLIP_WAKE_REASON`
- `PAPERCLIP_WAKE_COMMENT_ID`
- `PAPERCLIP_TASK_ID`
- `PAPERCLIP_WAKE_PAYLOAD_JSON`（部分 adapter/场景）

`skills/paperclip/SKILL.md` 也要求 Agent：

- comment wake 时优先读取该 comment。
- 被 mention 时先读 comment thread。
- 如果对方明确要求接手，可以 self-assign/checkout。

## 最佳实践

1. **默认基于 issue 评论沟通。**
   因为 Paperclip 的核心沟通模型就是 issue/comment。

2. **不要为一个澄清问题新建 issue。**
   小问题放在当前 issue comment，避免任务碎片化。

3. **新工作才新建 issue。**
   如果它有独立 owner、验收标准、生命周期，就创建新 issue。

4. **治理决策用 Approval。**
   比如招聘、预算、策略批准，不要只写 comment。

5. **Agent 提问要结构化。**
   提供背景、问题、选项、推荐方案、影响，方便人类快速决策。

6. **人类回复也应尽量在同一个 issue 下。**
   这样 wakeup、审计、上下文、run log 都能串起来。
