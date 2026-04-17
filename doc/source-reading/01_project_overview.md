# 01 项目全景解读：Paperclip

## 基本信息

- 源码位置：`/workspace/project/source`
- GitHub 仓库：`qiyadeng/paperclip`
- 当前分支：`master`
- 当前提交：`e93e418c fix: add ssh client and jq to production image (#3826)`
- 项目类型：Node.js + TypeScript Monorepo
- 包管理：`pnpm@9.15.4`
- Node 要求：`>=20`

## 一句话理解

Paperclip 是一个“AI-agent company control plane”：它不直接定义某一种 Agent 框架，而是提供公司、组织架构、Agent、目标、Issue、心跳执行、预算、审批、活动日志等控制面能力，用来协调外部或本地 AI Agent 像公司员工一样工作。

## 产品核心定位

从 `README.md`、`doc/GOAL.md`、`doc/PRODUCT.md` 和 `doc/SPEC-implementation.md` 可得出：

- Paperclip 是 **控制平面**，不是执行平面。
- 一个实例可以管理多个 company。
- company 是一等对象，业务数据必须 company-scoped。
- Agent 通过 adapter 接入，可以是 Claude Code、Codex、Cursor、Gemini、OpenClaw、HTTP、process、插件等。
- 工作以 issue/task/comment 为核心，不是通用 chatbot。
- Human board 负责治理、审批、预算、暂停、恢复、干预。

## 技术栈

| 层 | 技术 |
|---|---|
| Monorepo | pnpm workspace |
| 后端 | Express 5 + TypeScript + tsx |
| 前端 | React 19 + Vite 6 + React Router + TanStack Query |
| 数据库 | PostgreSQL + Drizzle ORM |
| 本地数据库 | embedded-postgres |
| 校验 | Zod |
| 日志 | pino / pino-http |
| 测试 | Vitest，Playwright e2e |
| CLI | commander + clack/prompts |
| 插件 | `@paperclipai/plugin-sdk` + worker/host RPC |

## Monorepo 包结构

工作区来自 `pnpm-workspace.yaml`：

```yaml
packages:
  - packages/*
  - packages/adapters/*
  - packages/plugins/*
  - packages/plugins/examples/*
  - server
  - ui
  - cli
```

核心 workspace：

| 路径 | 包名 | 作用 |
|---|---|---|
| `server/` | `@paperclipai/server` | Express REST API、调度、心跳、插件、认证、存储、业务服务 |
| `ui/` | `@paperclipai/ui` | Board 操作界面 |
| `cli/` | `paperclipai` | 安装、onboard、doctor、run、heartbeat、client commands |
| `packages/db/` | `@paperclipai/db` | Drizzle schema、migrations、DB client、embedded PostgreSQL 管理 |
| `packages/shared/` | `@paperclipai/shared` | API 类型、Zod validators、常量、共享工具 |
| `packages/adapter-utils/` | `@paperclipai/adapter-utils` | Agent adapter 公共工具 |
| `packages/adapters/*` | 多个 adapter 包 | Claude/Codex/Cursor/Gemini/OpenClaw/OpenCode/Pi 等 adapter |
| `packages/plugins/sdk/` | `@paperclipai/plugin-sdk` | 插件开发 SDK |

## 核心业务对象

```text
Company
 ├─ Goal
 ├─ Project
 ├─ Agent
 │   ├─ Agent API Key
 │   ├─ Agent Runtime State
 │   └─ Agent Task Session
 ├─ Issue
 │   ├─ Issue Comment
 │   ├─ Issue Document
 │   ├─ Issue Approval
 │   ├─ Work Product
 │   └─ Heartbeat Run
 ├─ Budget / Cost Event
 ├─ Approval
 ├─ Activity Log
 ├─ Secret
 ├─ Routine
 └─ Plugin state/config/job
```

## 本地开发命令

```bash
pnpm install
pnpm dev
```

本地默认启动：

- API：`http://localhost:3100`
- UI：由 API server 通过 Vite dev middleware 同源服务
- 如果未设置 `DATABASE_URL`，自动使用 embedded PostgreSQL

常用验证：

```bash
pnpm test
pnpm -r typecheck
pnpm test:run
pnpm build
```

## 第一印象

这个项目不是简单 CRUD 应用，而是一个偏“控制平面 + 工作流编排 + Agent runtime 接入”的系统。源码解读时建议先抓住这几条主线：

1. **公司/租户边界**：所有核心实体都围绕 `companyId`。
2. **Issue 是工作核心**：任务、评论、附件、文档、执行策略、工作产物都挂在 issue 上。
3. **Agent 通过 heartbeat 执行**：board/agent/API/定时器触发 heartbeat run。
4. **Adapter 是执行适配层**：后端统一调用 adapter，adapter 再调用 Claude/Codex/Cursor/OpenClaw 等。
5. **UI 是 board control surface**：所有页面围绕 company prefix、dashboard、issues、agents、projects、approvals、costs 展开。
6. **插件系统是扩展面**：plugin registry、worker manager、job scheduler、tool dispatcher 已经比较完整。
