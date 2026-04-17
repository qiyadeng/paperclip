# 05 数据模型与持久化初读

## 数据库技术

- ORM：Drizzle ORM
- 数据库：PostgreSQL
- 本地默认：未设置 `DATABASE_URL` 时启动 embedded PostgreSQL
- schema 位置：`packages/db/src/schema/`
- migration 位置：`packages/db/src/migrations/`
- DB client：`packages/db/src/client.ts`

## 核心模型关系

```text
companies
 ├─ agents
 │   ├─ agent_api_keys
 │   ├─ agent_runtime_state
 │   ├─ agent_task_sessions
 │   └─ heartbeat_runs
 ├─ goals
 ├─ projects
 ├─ issues
 │   ├─ issue_comments
 │   ├─ issue_documents
 │   ├─ issue_work_products
 │   ├─ issue_approvals
 │   └─ issue_attachments
 ├─ approvals
 ├─ cost_events
 ├─ budget_policies / budget_incidents
 ├─ activity_log
 ├─ company_secrets
 ├─ routines
 └─ plugin_* tables
```

## Company

文件：`packages/db/src/schema/companies.ts`

关键字段：

- `id`
- `name`
- `description`
- `status`
- `pauseReason`
- `issuePrefix`
- `issueCounter`
- `budgetMonthlyCents`
- `spentMonthlyCents`
- `requireBoardApprovalForNewAgents`
- `feedbackDataSharingEnabled`
- `brandColor`

理解：

- company 是租户/组织边界。
- issue 编号由 company 的 prefix 和 counter 管理。
- company 自身也有预算和暂停状态。

## Agent

文件：`packages/db/src/schema/agents.ts`

关键字段：

- `companyId`
- `name`
- `role`
- `title`
- `status`
- `reportsTo`
- `capabilities`
- `adapterType`
- `adapterConfig`
- `runtimeConfig`
- `budgetMonthlyCents`
- `spentMonthlyCents`
- `permissions`
- `lastHeartbeatAt`

理解：

- Agent 是公司员工，也是执行单元。
- `reportsTo` 自引用构成 org tree。
- `adapterType + adapterConfig` 决定这个 agent 如何被执行。
- `runtimeConfig` 与工作空间/运行时配置相关。

## Goal / Project / Issue

### Goal

文件：`packages/db/src/schema/goals.ts`

- 有 parent hierarchy。
- level 默认 `task`。
- 可由 agent owner。

### Project

文件：`packages/db/src/schema/projects.ts`

- 属于 company。
- 可绑定 goal。
- 可绑定 lead agent。
- 有 env，用于合并到 issue run environment。
- 有 execution workspace policy。

### Issue

文件：`packages/db/src/schema/issues.ts`

关键字段：

- `companyId`
- `projectId`
- `goalId`
- `parentId`
- `title`
- `description`
- `status`
- `priority`
- `assigneeAgentId`
- `assigneeUserId`
- `checkoutRunId`
- `executionRunId`
- `executionPolicy`
- `executionState`
- `executionWorkspaceId`
- `createdByAgentId`
- `createdByUserId`
- `identifier`
- `originKind/originId/originRunId`
- `requestDepth`
- `billingCode`

理解：

- Issue 是核心 task entity。
- 支持 parent issue、project、goal 关联。
- 支持 agent assignee 和 user assignee。
- 支持 execution policy/state，说明任务执行可以有多阶段审批/评审。
- 有 `checkoutRunId` 和 `executionRunId`，说明 task 与 heartbeat run 有锁/执行关联。

## Heartbeat Run

文件：`packages/db/src/schema/heartbeat_runs.ts`

关键字段：

- `companyId`
- `agentId`
- `invocationSource`
- `triggerDetail`
- `status`
- `startedAt/finishedAt`
- `error/exitCode/signal`
- `usageJson/resultJson`
- `sessionIdBefore/sessionIdAfter`
- `logStore/logRef/logBytes/logSha256/stdoutExcerpt/stderrExcerpt`
- `externalRunId`
- `processPid/processGroupId/processStartedAt`
- `retryOfRunId/processLossRetryCount`
- `contextSnapshot`

理解：

- 这是 Agent 执行事实记录。
- 同时支持本地 process、外部 run、日志存储、session continuity、失败恢复。

## Cost / Budget

文件：

```text
packages/db/src/schema/cost_events.ts
packages/db/src/schema/budget_policies.ts
packages/db/src/schema/budget_incidents.ts
```

理解：

- cost event 是事实记录。
- budget policy 是规则。
- budget incident 是触发/违规记录。
- cost 可挂到 company、agent、issue、project、goal、heartbeatRun。

## Activity Log

文件：`packages/db/src/schema/activity_log.ts`

字段：

- `companyId`
- `actorType`
- `actorId`
- `action`
- `entityType`
- `entityId`
- `agentId`
- `runId`
- `details`

理解：

- mutating action 应该写 activity log。
- 后续改造 mutation 行为时，要确认是否需要补 log。

## 改造数据模型时的规则

来自 `AGENTS.md`：

1. 修改 `packages/db/src/schema/*.ts`
2. 确保从 `packages/db/src/schema/index.ts` 导出
3. 运行：

```bash
pnpm db:generate
```

4. 验证：

```bash
pnpm -r typecheck
```

## 数据模型改造风险

1. **company-scoped invariant**：新增表/字段必须考虑 companyId。
2. **契约同步风险**：DB schema、shared types、server、ui 必须同步。
3. **migration 风险**：项目已有 50+ migration，新增 migration 要保持编号和顺序。
4. **运行中状态风险**：heartbeat_runs、issues 的 execution/checkout 字段可能涉及恢复和锁。
5. **预算和审计风险**：改动 cost/budget/activity 会影响治理能力。
