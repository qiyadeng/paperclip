import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  parseObject,
  ensureCommandResolvable,
  ensurePathInEnv,
} from "@paperclipai/adapter-utils/server-utils";
import { sanitizeSlug } from "./slug.js";

const PROBE_TIMEOUT_MS = 5_000;

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);

  const providerLabel = asString(config.providerLabel, "").trim();
  const baseUrl = asString(config.baseUrl, "").trim();
  const apiKey = asString(config.apiKey, "").trim();
  const model = asString(config.model, "").trim();
  const command = asString(config.command, "codex");

  const runtimeEnv = ensurePathInEnv(
    Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  );
  try {
    await ensureCommandResolvable(command, process.cwd(), runtimeEnv);
    checks.push({ code: "codex_present", level: "info", message: `Codex binary "${command}" is on PATH.` });
  } catch (err) {
    checks.push({
      code: "codex_missing",
      level: "error",
      message: err instanceof Error ? err.message : "codex binary not found",
      hint: "Install Codex CLI and ensure it is on PATH.",
    });
  }

  if (!baseUrl || !isHttpUrl(baseUrl)) {
    checks.push({
      code: "invalid_base_url",
      level: "error",
      message: "baseUrl must be a valid http(s) URL.",
      detail: baseUrl || "(empty)",
    });
  }

  if (!apiKey) {
    checks.push({
      code: "api_key_missing",
      level: "error",
      message: "apiKey is required.",
    });
  }

  const slug = sanitizeSlug(providerLabel);
  if (!providerLabel || slug === "provider") {
    checks.push({
      code: "invalid_provider_label",
      level: "error",
      message: 'providerLabel must contain ASCII alphanumerics; got fallback "provider".',
      detail: providerLabel || "(empty)",
    });
  }

  if (!model) {
    checks.push({
      code: "model_missing",
      level: "error",
      message: "model is required.",
    });
  }

  if (config.requestHeaders != null && config.requestHeaders !== "") {
    try {
      const parsed = typeof config.requestHeaders === "string"
        ? JSON.parse(config.requestHeaders)
        : config.requestHeaders;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      for (const v of Object.values(parsed)) {
        if (typeof v !== "string") throw new Error("non-string value");
      }
    } catch (err) {
      checks.push({
        code: "invalid_request_headers",
        level: "error",
        message: "requestHeaders must be a JSON object of string→string.",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const requiredFailed = checks.some((c) => c.level === "error");
  if (!requiredFailed) {
    const probeUrl = baseUrl.replace(/\/+$/, "") + "/models";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const res = await fetch(probeUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      if (res.status === 200) {
        checks.push({ code: "probe_ok", level: "info", message: "GET /models returned 200." });
      } else if (res.status === 401 || res.status === 403) {
        checks.push({
          code: "auth_failed",
          level: "warn",
          message: `GET /models returned ${res.status} — API key may be wrong, or the provider rejects bearer auth on this path.`,
        });
      } else if (res.status === 404) {
        checks.push({
          code: "models_endpoint_unsupported",
          level: "warn",
          message: "GET /models returned 404 — provider may not expose /models. The first real run will surface auth failures.",
        });
      } else {
        checks.push({
          code: "probe_unexpected_status",
          level: "warn",
          message: `GET /models returned unexpected status ${res.status}.`,
        });
      }
    } catch (err) {
      checks.push({
        code: "endpoint_unreachable",
        level: "warn",
        message: "Could not reach /models probe.",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    adapterType: "codex_openai_compat",
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
