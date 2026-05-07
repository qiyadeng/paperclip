import type { UIAdapterModule } from "../types";
import { parseCodexStdoutLine } from "@paperclipai/adapter-codex-openai-compat/ui";
import { SchemaConfigFields, buildSchemaAdapterConfig } from "../schema-config-fields";

export const codexOpenAiCompatUIAdapter: UIAdapterModule = {
  type: "codex_openai_compat",
  label: "Codex (OpenAI-compatible)",
  parseStdoutLine: parseCodexStdoutLine,
  ConfigFields: SchemaConfigFields,
  buildAdapterConfig: buildSchemaAdapterConfig,
};
