# 07 Agent 调度与 Issue 创建机制

## 结论先行

Paperclip 里的 Agent 调度不是“全局调度器自动拆任务、自动决定谁做什么”的模式，而是围绕 **Issue + Wakeup + Heartbeat Run + Adapter** 形成的事件驱动调度。

核心链路：

```text
Issue 被创建/更新/评论/定时触发
→ 生成 agent_wakeup_requests
→ 生成 heartbeat_runs queued
→ 按 agent 维度排队/并发控制
→ heartbeat run claimed 为 running
→ 调用对应 adapter.execute()
→ Agent Runtime 工作
→ 写回 comment/status/cost/activity/session
```

## 核心调度对象

### 1. `issues`

Issue 是任务实体。

关键字段：

- `assigneeAgentId`：当前分配给哪个 agent。
- `status`：`backlog | todo | in_progress | in_review | blocked | done | cancelled`。
- `checkoutRunId`：哪个 run checkout 了该 issue。
- `executionRunId`：哪个 heartbeat run 正在执行该 issue。
- `executionPolicy / executionState`：执行/评审/审批阶段。

### 2. `agent_wakeup_requests`

Wakeup request 是“叫醒某个 agent”的请求。

常见来源：

- assignment
- timer
- automation
- on_demand

常见 reason：

- `issue_assigned`
- `issue_status_changed`
- `issue_commented`
- `issue_comment_mentioned`
- `issue_checked_out`
- `heartbeat_timer`
- `issue_blockers_resolved`
- `issue_children_completed`

### 3. `heartbeat_runs`

Heartbeat run 是一次具体执行。

状态：

```text
queued → running → succeeded / failed / cancelled / timed_out
```

它会记录：

- agentId
- companyId
- invocationSource
- triggerDetail
- contextSnapshot
- sessionIdBefore / sessionIdAfter
- usageJson / resultJson
- stdout/stderr excerpt
- run log

## Agent 是如何被调度的

调度核心在：

```text
server/src/services/heartbeat.ts
```

关键函数：

- `wakeup()` / `enqueueWakeup()`：生成 wakeup request 和 queued run。
- `startNextQueuedRunForAgent()`：按 agent 启动可执行 run。
- `claimQueuedRun()`：把 queued run 原子转成 running。
- `executeRun()`：准备上下文、workspace、session，然后调用 adapter。
- `tickTimers()`：定时检查 agent heartbeat policy。
- `resumeQueuedRuns()`：服务重启后恢复 queued run。
- `reconcileStrandedAssignedIssues()`：修复无活跃执行路径的 assigned issue。

## 调度规则概览

### 1. 按 Agent 维度排队

每个 agent 有自己的 queued/running runs。

`startNextQueuedRunForAgent(agentId)` 会：

1. 检查 agent 是否存在。
2. 检查 agent 是否 paused/terminated/pending_approval。
3. 解析 agent heartbeat policy。
4. 计算并发槽位 `maxConcurrentRuns - runningCount`。
5. 按 `createdAt` 取最早 queued runs。
6. claim 后异步执行。

### 2. 同一任务会合并或延后

`enqueueWakeup()` 会避免重复调度：

- 如果同一 task scope 已有 queued/running run，可能合并 context。
- 如果某个 issue 已经有 active execution run，新的 wakeup 可能变成 `deferred_issue_execution`。
- 当前 run 完成后，`releaseIssueExecutionAndPromote()` 会把 deferred wakeup 提升成新的 queued run。

### 3. 真正执行前才锁 issue

`claimQueuedRun()` 把 run 从 queued 变 running 时，才给 issue 写：

- `executionRunId`
- `executionAgentNameKey`
- `executionLockedAt`

代码注释称这是 lazy locking：queue 阶段不锁，running 阶段才锁。

### 4. 执行时会自动 checkout issue

`executeRun()` 中，如果 context 里有 issueId，且满足条件，会调用：

```text
issuesSvc.checkout(issueId, agent.id, ["todo", "backlog", "blocked"], run.id)
```

也就是说，对 assignment wakeup 来说，Paperclip harness 可能在 run 开始时自动 checkout issue。

## Issue 一般是谁创建的

### 1. Board 用户手动创建

这是最常见路径。

前端入口：

```text
ui/src/components/NewIssueDialog.tsx
ui/src/api/issues.ts
```

后端入口：

```text
POST /api/companies/:companyId/issues
server/src/routes/issues.ts
```

Board 可以创建 issue，也可以直接指定：

- assigneeAgentId
- assigneeUserId
- projectId
- goalId
- parentId
- priority
- status

如果创建时指定了 assignee agent，且状态不是 backlog，会触发 wakeup。

### 2. Agent 自己创建

Agent 可以通过 agent API key 或 local agent JWT 调用同一个接口：

```text
POST /api/companies/:companyId/issues
```

创建后会记录：

- `createdByAgentId`
- `createdByRunId` 相关上下文通过 request actor/runId 体现

Agent 创建 issue 的典型场景：

- CEO 或 manager agent 拆分战略任务。
- 当前执行 agent 创建 subtask。
- Agent 遇到 blocker，创建 follow-up。
- Agent 需要把工作分配给另一个 agent。

项目内置 CEO heartbeat 指南明确写了：

```text
Create subtasks with POST /api/companies/{companyId}/issues.
Always set parentId and goalId.
```

文件：

```text
server/src/onboarding-assets/ceo/HEARTBEAT.md
```

### 3. Routine 自动创建

Routine 是定时/触发型工作。

相关文件：

```text
server/src/services/routines.ts
```

当 routine trigger 被触发时，会调用：

```text
issueSvc.create(...)
```

创建一个 `originKind = "routine_execution"` 的 issue，并通常设置：

- `status: "todo"`
- `assigneeAgentId`
- `goalId`
- `parentId`
- `originRunId`

然后调用：

```text
queueIssueAssignmentWakeup(...)
```

把对应 agent 叫醒。

### 4. CLI 创建

CLI 也能创建 issue：

```text
paperclipai issue create
```

相关文件：

```text
cli/src/commands/client/issue.ts
```

本质上还是调用：

```text
POST /api/companies/:companyId/issues
```

## 决定创建 Issue 的因素是什么

当前代码里没有一个“中央 AI 调度器”自动决定创建所有 issue。Issue 创建决策主要来自四类来源：

### 1. 人类 Board 的显式决策

用户在 UI/CLI 中点击 New Issue 或执行 CLI 命令。

这是人工决策。

### 2. Agent 的执行策略/角色指令

Agent 在 heartbeat 执行时，根据自己的 instructions、issue context、company goal、当前 blocker 或 delegation 需要，主动调用 API 创建 issue。

例如 CEO agent 的 `HEARTBEAT.md` 要求它：

- 查看分配给自己的任务。
- 做战略拆解。
- 创建 subtasks。
- 给合适的 agent 分配工作。

这种情况下，“决定创建 issue”的不是 server 代码里的规则，而是 agent runtime 根据提示词/上下文作出的行为。

### 3. Routine 的配置和触发条件

Routine 会根据：

- schedule trigger
- public trigger
- manual run
- concurrency policy
- assignee
- project/goal/parent issue 配置

决定是否创建 routine execution issue。

### 4. 系统恢复/流程推进不会通常创建新 Issue，而是创建 Wakeup

很多自动化行为并不创建 issue，而是创建 wakeup：

- issue 被分配
- issue 从 backlog 变 todo
- issue 被评论
- comment @mention agent
- blocker issue done
- child issue done
- deferred execution promoted
- heartbeat timer elapsed
- stranded assigned issue recovery

这些行为通常只是让已有 issue 继续流转，不新建 issue。

## 创建后是否会立刻调度 Agent

取决于两个条件：

1. issue 是否有 `assigneeAgentId`。
2. issue 状态是否不是 `backlog`。

在 `queueIssueAssignmentWakeup()` 中有明确判断：

```ts
if (!input.issue.assigneeAgentId || input.issue.status === "backlog") return;
```

所以：

- 创建 backlog issue：只进入 backlog，不叫醒 agent。
- 创建 todo issue 且指定 assignee agent：会叫醒 agent。
- 创建 issue 但未指定 agent：不会叫醒任何 agent。

## Agent 之间如何协作

Paperclip 不是让 agent 直接互相发消息，而是通过 Issue/Comment/Wakeup 协作。

常见协作方式：

1. **上级创建子任务给下级**
   - CEO/manager 创建 issue，设置 `parentId`、`goalId`、`assigneeAgentId`。
   - Paperclip wakeup 被分配的 agent。

2. **评论唤醒 assignee**
   - Board 或其他 agent 在 issue 上评论。
   - 如果不是 assignee 自己评论，会 wake assignee。

3. **@mention 唤醒指定 agent**
   - 评论中提到 agent。
   - 系统解析 mention 并 wake 被提到的 agent。

4. **依赖解除唤醒 dependent issue assignee**
   - blocker issue done 后，系统找出可唤醒的 blocked dependents。

5. **子任务完成唤醒 parent assignee**
   - child issue done/cancelled 后，可能唤醒 parent issue 的 assignee。

## 一句话总结

Issue 的创建由 board、agent、routine、CLI 等入口触发；Agent 的调度由 issue assignment、comment、mention、status change、routine、timer 等事件生成 wakeup，再由 heartbeat service 按 agent 维度排队、合并、延后、执行。Server 负责调度和约束，真正“是否要拆出新 issue”的业务判断，通常来自人类 board 或 agent 的执行策略。
