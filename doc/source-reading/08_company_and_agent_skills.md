# 08 Company / Agent Skills 机制解读

## 结论

Paperclip 里的 Skill 本质上是给 Agent 的“操作手册 / 能力说明 / 工作流规范”，通常以 `SKILL.md` 为入口。它不是数据库里的业务代码，也不是直接执行的插件，而是会在 Agent 运行时被注入到本地 Agent runtime，使 Agent 知道如何正确使用 Paperclip API、如何记忆、如何招聘 Agent、如何创建插件等。

核心作用：

```text
让 Agent 不只是会聊天/写代码，而是知道如何在 Paperclip 公司系统里协作、治理、记忆、招聘、扩展。
```

## Company Skills 是怎么来的

内置技能目录：

```text
skills/
├── paperclip/
├── paperclip-create-agent/
├── paperclip-create-plugin/
└── para-memory-files/
```

数据库表：

```text
packages/db/src/schema/company_skills.ts
```

服务代码：

```text
server/src/services/company-skills.ts
```

关键逻辑：

```text
list/listFull/listRuntimeSkillEntries
→ ensureSkillInventoryCurrent(companyId)
→ ensureBundledSkills(companyId)
→ 扫描 repo 的 skills/ 目录
→ upsert 到 company_skills
```

也就是说，公司创建后，并不是一定在 create company 事务里立即写入这些 skill；而是在访问公司技能库或构建 agent runtime skills 时，按 company 懒加载/确保存在。

内置技能会被标记为：

```text
metadata.sourceKind = "paperclip_bundled"
```

并且在 runtime skill entries 中被标记为 required：

```text
required: true
requiredReason: "Bundled Paperclip skills are always available for local adapters."
```

## Agent 如何拿到 Skills

相关代码：

```text
server/src/routes/agents.ts
server/src/services/heartbeat.ts
packages/adapter-utils/src/server-utils.ts
```

Agent 执行时，heartbeat 会调用：

```text
companySkills.listRuntimeSkillEntries(agent.companyId)
```

然后把结果注入 adapter config：

```text
paperclipRuntimeSkills: runtimeSkillEntries
```

部分 adapter 直接读取 `config.paperclipRuntimeSkills`；部分 adapter 需要先把 skill materialize 到磁盘目录再扫描，能力由：

```text
requiresMaterializedRuntimeSkills
```

控制。

Agent 也可以有额外指定技能：

```text
desiredSkills
```

创建/雇佣 agent 时可以传：

```text
POST /api/companies/:companyId/agents
POST /api/companies/:companyId/agent-hires
```

也可以之后同步：

```text
POST /api/agents/:agentId/skills/sync
```

## 内置 Skills 解决什么问题

### 1. `paperclip`

路径：

```text
skills/paperclip/SKILL.md
```

定位：Paperclip 控制面协作技能。

解决的问题：

- Agent 如何识别自己的身份和公司上下文。
- 如何查询自己的任务。
- 如何 checkout issue。
- 如何更新 issue 状态。
- 如何写 comment。
- 如何创建 subtask。
- 如何处理 approval follow-up。
- 如何正确带上 `X-Paperclip-Run-Id`，保证审计链路。
- 如何避免重复读取所有上下文。
- 如何处理 comment wake、mention wake、blocked task。

它是所有 Agent 在 Paperclip 内工作的基础操作规范。

一句话：

```text
paperclip skill 解决“Agent 如何在 Paperclip 里合法、可追踪、可协作地做任务”的问题。
```

### 2. `paperclip-create-agent`

路径：

```text
skills/paperclip-create-agent/SKILL.md
```

定位：治理感知的 Agent 招聘 / 创建技能。

解决的问题：

- 如何查看 adapter 配置文档。
- 如何比较现有 agent 配置。
- 如何为新 agent 选择 role/title/icon/reportsTo。
- 如何设置 adapterType、adapterConfig、runtimeConfig。
- 如何给新 agent 绑定 desiredSkills。
- 如何通过 hire request 走审批。
- 如何处理 hire approval 被批准后的后续任务。

它让 CEO/manager agent 能“招聘下属”，但不是绕过治理直接创建。

一句话：

```text
paperclip-create-agent skill 解决“Agent 如何安全地扩编团队”的问题。
```

### 3. `para-memory-files`

路径：

```text
skills/para-memory-files/SKILL.md
```

定位：文件化长期记忆系统。

解决的问题：

- Agent session 会中断，不能只靠上下文窗口记忆。
- 公司/用户/项目知识需要跨 heartbeat 保存。
- 事实、计划、日记、经验需要分层管理。

它定义三层记忆：

```text
$AGENT_HOME/life/       # PARA 知识图谱：projects / areas / resources / archives
$AGENT_HOME/memory/     # Daily notes，按日期记录原始时间线
$AGENT_HOME/MEMORY.md   # tacit knowledge，用户/工作模式经验
```

一句话：

```text
para-memory-files skill 解决“Agent 如何跨多次 heartbeat 持久记忆和检索知识”的问题。
```

### 4. `paperclip-create-plugin`

路径：

```text
skills/paperclip-create-plugin/SKILL.md
```

定位：Paperclip 插件开发技能。

解决的问题：

- 如何使用当前 alpha plugin SDK。
- 如何脚手架新插件。
- 如何写 `manifest.ts`、worker、UI、测试。
- 插件能力边界是什么。
- 插件应该如何验证和构建。

一句话：

```text
paperclip-create-plugin skill 解决“如何按 Paperclip 现有插件架构扩展系统”的问题。
```

## Skills 和默认 Agent 指令的区别

除了 Skill，公司创建/Agent 创建时还会有默认 instructions bundle。

相关目录：

```text
server/src/onboarding-assets/
├── ceo/
│   ├── AGENTS.md
│   ├── HEARTBEAT.md
│   ├── SOUL.md
│   └── TOOLS.md
└── default/
    └── AGENTS.md
```

相关代码：

```text
server/src/services/default-agent-instructions.ts
server/src/routes/agents.ts
```

规则：

- `role === "ceo"` 的 Agent 会得到 CEO 专属指令包。
- 其他 Agent 会得到 default `AGENTS.md`。

CEO 的默认指令明确要求：

- 不做普通 IC 工作，要委派。
- 技术任务交 CTO，营销交 CMO，设计交 UXDesigner。
- 如果没有合适下属，用 `paperclip-create-agent` skill 招聘。
- 记忆相关必须用 `para-memory-files` skill。

所以：

```text
Instructions bundle = 角色人格与工作规则
Skills = 可复用的具体工作流手册
```

## 为什么要这样设计

这些内置 Skills 主要解决四个系统性问题：

1. **协作一致性**
   - 所有 Agent 都知道 Paperclip API 怎么用。
   - checkout、comment、status update、run id 审计不容易乱。

2. **组织治理**
   - 招聘 agent 要走 hire request / approval。
   - Agent 不应该随便绕过 board 创建团队成员。

3. **长期记忆**
   - Agent 每次 heartbeat 都可能是短生命周期。
   - PARA memory 让 Agent 能跨运行保存事实和计划。

4. **可扩展性**
   - 插件开发有统一规则。
   - 公司也能导入外部技能，再分配给特定 Agent。

## 对后续改造的启发

如果你后面要改造 Paperclip，要区分三类东西：

1. **系统内置必备能力**
   - 比如 `paperclip` skill。
   - 这类能力应保持所有 Agent 都能拿到。

2. **角色默认行为**
   - 比如 CEO 的 delegation 规则。
   - 这更适合放在 onboarding-assets 的 instructions bundle。

3. **可选专业能力**
   - 比如 browser QA、design、plugin authoring、SEO、财务分析等。
   - 这类适合放进 company skill library，然后通过 `desiredSkills` 分配给特定 Agent。
