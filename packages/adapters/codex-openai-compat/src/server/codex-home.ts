import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

export interface IsolatedCodexHomeKey {
  companyId: string;
  agentId: string;
}

/**
 * Resolve the isolated CODEX_HOME directory for a given agent.
 * Honors PAPERCLIP_HOME (default ~/.paperclip) and PAPERCLIP_INSTANCE_ID
 * (default "default"). Layout:
 *
 *   <PAPERCLIP_HOME>/instances/<INSTANCE>/companies/<companyId>/codex-openai-compat/<agentId>/codex-home/
 *
 * This directory is intentionally NOT seeded from the operator's `~/.codex`
 * — third-party API keys must not co-mingle with the operator's real Codex
 * login state.
 */
export function resolveIsolatedCodexHomeDir(
  env: NodeJS.ProcessEnv,
  key: IsolatedCodexHomeKey,
): string {
  const home = env.PAPERCLIP_HOME && env.PAPERCLIP_HOME.trim().length > 0
    ? env.PAPERCLIP_HOME
    : path.join(os.homedir(), ".paperclip");
  const instanceId = env.PAPERCLIP_INSTANCE_ID && env.PAPERCLIP_INSTANCE_ID.trim().length > 0
    ? env.PAPERCLIP_INSTANCE_ID
    : "default";
  return path.join(
    home,
    "instances",
    instanceId,
    "companies",
    key.companyId,
    "codex-openai-compat",
    key.agentId,
    "codex-home",
  );
}

/**
 * Realize the isolated CODEX_HOME on disk by ensuring the directory exists
 * and writing config.toml. Overwrites config.toml every call so changes to
 * agent config take effect on the next run.
 */
export async function realizeIsolatedCodexHome(
  homeDir: string,
  configToml: string,
): Promise<void> {
  await fs.mkdir(homeDir, { recursive: true });
  await fs.writeFile(path.join(homeDir, "config.toml"), configToml, "utf8");
}
