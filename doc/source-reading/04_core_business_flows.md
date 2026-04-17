# 04 核心业务流程初读

本文件先列出建议优先解读的核心链路。后续可以一条一条展开到函数级调用链。

## 建议优先级

建议按下面顺序深入：

1. Company 创建与 onboarding
2. Agent 创建/雇佣与 adapter 配置
3. Issue 创建、分配、checkout、评论、状态流转
4. Heartbeat run 执行链路
5. Budget/cost hard-stop 链路
6. Approval 治理链路
7. Plugin/adapter 扩展链路

如果后续要改造代码，前四条优先级最高。

## 链路 1：Company / Onboarding

相关文件：

```text
ui/src/components/OnboardingWizard.tsx
ui/src/pages/Companies.tsx
ui/src/api/companies.ts
server/src/routes/companies.ts
server/src/services/companies.ts
packages/shared/src/validators/company.ts
packages/shared/src/types/company.ts
packages/db/src/schema/companies.ts
cli/src/commands/onboard.ts
```

核心数据表：

```text
companies
company_memberships
company_logos
instance_user_roles
```

关注点：

- company 是所有业务数据的边界。
- company 创建时是否会自动创建 goal/agent/starter issue，需要继续追踪 onboarding wizard 和 company service。
- company 有 `issuePrefix` 和 `issueCounter`，issue identifier 由 company 维度管理。

## 链路 2：Agent 创建、组织结构与 Adapter

相关文件：

```text
ui/src/pages/Agents.tsx
ui/src/pages/NewAgent.tsx
ui/src/pages/AgentDetail.tsx
ui/src/components/AgentConfigForm.tsx
ui/src/api/agents.ts
server/src/routes/agents.ts
server/src/services/agents.ts
server/src/adapters/registry.ts
server/src/adapters/types.ts
packages/db/src/schema/agents.ts
packages/db/src/schema/agent_api_keys.ts
packages/db/src/schema/agent_runtime_state.ts
packages/shared/src/types/agent.ts
packages/shared/src/validators/agent.ts
```

核心字段：

```text
agents.companyId
agents.name / role / title
agents.status
agents.reportsTo
agents.adapterType
agents.adapterConfig
agents.runtimeConfig
agents.permissions
agents.lastHeartbeatAt
```

关注点：

- Agent 与 manager 必须同 company。
- org chart 是 strict tree。
- `adapterType + adapterConfig` 决定这个 agent 如何被执行。
- 后续如果要扩展一种新 agent runtime，优先看 adapter 接口和 plugin adapter 能力。

## 链路 3：Issue 生命周期

相关文件：

```text
ui/src/pages/Issues.tsx
ui/src/pages/IssueDetail.tsx
ui/src/api/issues.ts
server/src/routes/issues.ts
server/src/services/issues.ts
server/src/services/issue-assignment-wakeup.ts
server/src/services/issue-execution-policy.ts
server/src/services/issue-goal-fallback.ts
packages/db/src/schema/issues.ts
packages/db/src/schema/issue_comments.ts
packages/db/src/schema/issue_documents.ts
packages/db/src/schema/issue_work_products.ts
packages/shared/src/types/issue.ts
packages/shared/src/validators/issue.ts
```

核心状态：

```text
backlog | todo | in_progress | in_review | blocked | done | cancelled
```

核心 API：

```text
GET    /api/companies/:companyId/issues
POST   /api/companies/:companyId/issues
GET    /api/issues/:id
PATCH  /api/issues/:id
DELETE /api/issues/:id
POST   /api/issues/:id/checkout
POST   /api/issues/:id/release
GET    /api/issues/:id/comments
POST   /api/issues/:id/comments
```

关键业务点：

- issue 必须 company-scoped。
- issue 可以关联 project、goal、parent issue。
- 单 assignee 模型。
- `in_progress` 与 checkout/run lock 相关。
- issue comment 可能触发 wakeup。
- issue execution policy 支持 review/approval/executor 多阶段。
- issue 可以关联 document、work product、attachment、feedback、approval。

## 链路 4：Heartbeat Run 执行

相关文件：

```text
server/src/services/heartbeat.ts
server/src/routes/agents.ts
server/src/routes/activity.ts
server/src/adapters/registry.ts
server/src/adapters/process/index.ts
server/src/adapters/http/index.ts
packages/db/src/schema/heartbeat_runs.ts
packages/db/src/schema/heartbeat_run_events.ts
cli/src/commands/heartbeat-run.ts
```

核心表：

```text
heartbeat_runs
heartbeat_run_events
agent_wakeup_requests
agent_task_sessions
agent_runtime_state
```

核心字段：

```text
heartbeat_runs.status
heartbeat_runs.invocationSource
heartbeat_runs.triggerDetail
heartbeat_runs.sessionIdBefore / sessionIdAfter
heartbeat_runs.logStore / logRef / stdoutExcerpt / stderrExcerpt
heartbeat_runs.usageJson / resultJson
heartbeat_runs.contextSnapshot
```

运行链路粗图：

```text
Timer/User/API/Issue Wakeup
→ heartbeatService
→ create/update heartbeat_run
→ resolve adapter by agent.adapterType
→ adapter.execute()
→ local/external agent runtime
→ update run / issue / activity / cost / session state
```

关注点：

- 这是整个系统最核心、复杂度最高的链路。
- 需要重点看 run status、锁、恢复、取消、session 管理。
- 后续改造 Agent 执行模式时，优先从这里入手。

## 链路 5：Budget / Cost

相关文件：

```text
ui/src/pages/Costs.tsx
ui/src/api/costs.ts
server/src/routes/costs.ts
server/src/services/costs.ts
server/src/services/budgets.ts
packages/db/src/schema/cost_events.ts
packages/db/src/schema/budget_policies.ts
packages/db/src/schema/budget_incidents.ts
packages/shared/src/types/cost.ts
packages/shared/src/types/budget.ts
```

关注点：

- cost event 绑定 company、agent、issue、project、goal、heartbeat run。
- budget policy 有 scope、window、amount、warnPercent、hardStopEnabled。
- hard stop 应该会影响 company/agent/project/issue 暂停或拒绝执行。

## 链路 6：Approval 治理

相关文件：

```text
ui/src/pages/Approvals.tsx
ui/src/pages/ApprovalDetail.tsx
ui/src/api/approvals.ts
server/src/routes/approvals.ts
server/src/services/approvals.ts
packages/db/src/schema/approvals.ts
packages/db/src/schema/approval_comments.ts
packages/db/src/schema/issue_approvals.ts
packages/shared/src/types/approval.ts
packages/shared/src/validators/approval.ts
```

关注点：

- approval 是 board governance 的关键能力。
- 可能和 hires、CEO strategy、issue execution policy 关联。
- 改造治理流程时，需要同步 issue execution 和 activity log。

## 下一步建议

下一轮建议深入 **Issue 生命周期**，因为它连接了：

```text
Company → Goal/Project → Issue → Comment/Document/Work Product → Heartbeat Run → Agent/Adapter → Activity/Cost/Approval
```

理解了 Issue，基本就能串起整个 Paperclip 的核心控制面。
