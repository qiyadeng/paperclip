import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import { execute as codexLocalExecute } from "@paperclipai/adapter-codex-local/server";
import { sanitizeSlug } from "./slug.js";
import { renderProviderToml, type WireApi } from "./config-toml.js";
import {
  resolveIsolatedCodexHomeDir,
  realizeIsolatedCodexHome,
} from "./codex-home.js";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseRequestHeaders(value: unknown): Record<string, string> | null {
  if (value == null || value === "") return null;
  let parsed: unknown;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("codex_openai_compat: requestHeaders must be a JSON object of string→string");
    }
  } else {
    parsed = value;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("codex_openai_compat: requestHeaders must be a JSON object of string→string");
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== "string") {
      throw new Error("codex_openai_compat: requestHeaders values must be strings");
    }
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function readWireApi(value: unknown): WireApi {
  return value === "responses" ? "responses" : "chat";
}

function readEnvObject(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export async function execute(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const config = (ctx.config ?? {}) as Record<string, unknown>;

  const providerLabel = readString(config.providerLabel);
  if (!providerLabel) throw new Error("codex_openai_compat: providerLabel is required");

  const baseUrl = readString(config.baseUrl);
  if (!baseUrl) throw new Error("codex_openai_compat: baseUrl is required");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("codex_openai_compat: baseUrl must start with http:// or https://");
  }

  const apiKey = readString(config.apiKey);
  if (!apiKey) throw new Error("codex_openai_compat: apiKey is required");

  const model = readString(config.model);
  if (!model) throw new Error("codex_openai_compat: model is required");

  const wireApi = readWireApi(config.wireApi);
  const requestHeaders = parseRequestHeaders(config.requestHeaders);
  const slug = sanitizeSlug(providerLabel);

  const homeDir = resolveIsolatedCodexHomeDir(process.env, {
    companyId: ctx.agent.companyId,
    agentId: ctx.agent.id,
  });
  const toml = renderProviderToml({
    slug,
    providerLabel,
    baseUrl,
    model,
    wireApi,
    requestHeaders,
  });
  await realizeIsolatedCodexHome(homeDir, toml);

  const userEnv = readEnvObject(config.env);
  const mergedEnv: Record<string, string> = {
    CODEX_HOME: homeDir,
    OPENAI_API_KEY: apiKey,
    ...userEnv,
  };

  const userExtraArgs = Array.isArray(config.extraArgs)
    ? config.extraArgs.filter((v): v is string => typeof v === "string")
    : [];
  const extraArgs = ["--profile", slug, ...userExtraArgs];

  const { fastMode: _fm, search: _s, ...rest } = config as Record<string, unknown>;
  const modifiedConfig = {
    ...rest,
    env: mergedEnv,
    extraArgs,
  };

  const result = await codexLocalExecute({
    ...ctx,
    config: modifiedConfig,
  });

  return {
    ...result,
    provider: slug,
    biller: slug,
    billingType: "api",
  };
}
