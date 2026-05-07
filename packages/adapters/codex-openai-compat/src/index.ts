import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";

export const type = "codex_openai_compat";
export const label = "Codex (OpenAI-compatible)";

export const models: { id: string; label: string }[] = [];

export const agentConfigurationDoc = `# codex_openai_compat agent configuration

Adapter: codex_openai_compat

Wraps the Codex CLI but routes requests to a third-party OpenAI Chat
Completions–compatible endpoint (DeepSeek, Qwen, Kimi, SiliconFlow,
OpenRouter, Azure OpenAI, etc.). The existing codex_local adapter is
unaffected.

Required fields:
- providerLabel (string): user-facing name, e.g. "DeepSeek". Sanitized to a slug used as codex profile name.
- baseUrl (string): OpenAI-compatible base URL, e.g. https://api.deepseek.com/v1
- apiKey (string): plaintext API key. Stored as plaintext in adapterConfig — for production / shared deployments use Paperclip's secrets system instead.
- model (string): provider-specific model id, e.g. deepseek-chat, qwen-max.

Optional fields:
- wireApi ("chat" | "responses", default "chat"): codex wire_api setting.
- requestHeaders (object): extra HTTP headers passed via codex http_headers.
- modelReasoningEffort: passes through to codex (most third parties ignore it).
- dangerouslyBypassApprovalsAndSandbox (boolean, default true): same as codex_local.

Inherited core fields (same behavior as codex_local):
- cwd, instructionsFilePath, promptTemplate, extraArgs, env, workspaceStrategy, timeoutSec, graceSec.

Notes:
- Codex runs against an isolated CODEX_HOME under
  ~/.paperclip/instances/<id>/companies/<companyId>/codex-openai-compat/<agentId>/codex-home/
  to keep the third-party API key separate from your real Codex login.
- The cost USD column shows 0 for runs from this adapter (token usage is still recorded). Monthly budget hard-stops will not throttle this adapter on dollar spend.
- Codex exec still discovers repo AGENTS.md from the active workspace, same as codex_local.
`;

export function getConfigSchema(): AdapterConfigSchema {
  return {
    fields: [
      {
        key: "providerLabel",
        label: "Provider label",
        type: "text",
        required: true,
        hint: 'Display name, e.g. "DeepSeek". Used as the codex profile slug.',
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "text",
        required: true,
        hint: "OpenAI-compatible endpoint, e.g. https://api.deepseek.com/v1",
      },
      {
        key: "apiKey",
        label: "API key",
        type: "text",
        required: true,
        meta: { sensitive: true },
        hint: "Stored as plaintext in adapterConfig.",
      },
      {
        key: "model",
        label: "Model",
        type: "combobox",
        required: true,
        hint: "Provider-specific model id, e.g. deepseek-chat, qwen-max.",
      },
      {
        key: "wireApi",
        label: "Wire API",
        type: "select",
        default: "chat",
        options: [
          { label: "chat (recommended)", value: "chat" },
          { label: "responses", value: "responses" },
        ],
      },
      {
        key: "requestHeaders",
        label: "Extra request headers (JSON)",
        type: "textarea",
        hint: 'JSON object of string→string, e.g. {"X-Custom": "value"}',
      },
      {
        key: "modelReasoningEffort",
        label: "Model reasoning effort",
        type: "select",
        options: [
          { label: "(default)", value: "" },
          { label: "minimal", value: "minimal" },
          { label: "low", value: "low" },
          { label: "medium", value: "medium" },
          { label: "high", value: "high" },
          { label: "xhigh", value: "xhigh" },
        ],
      },
      {
        key: "dangerouslyBypassApprovalsAndSandbox",
        label: "Bypass approvals and sandbox",
        type: "toggle",
        default: true,
      },
    ],
  };
}
