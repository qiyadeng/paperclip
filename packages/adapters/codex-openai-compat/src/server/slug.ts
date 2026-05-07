const FALLBACK = "provider";

/**
 * Sanitize a free-form provider label into a codex-safe profile/provider id.
 * Lowercases, replaces non-alphanumerics with underscore, collapses runs,
 * trims leading/trailing underscores, falls back to "provider" if empty.
 */
export function sanitizeSlug(input: unknown): string {
  if (typeof input !== "string") return FALLBACK;
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned : FALLBACK;
}
