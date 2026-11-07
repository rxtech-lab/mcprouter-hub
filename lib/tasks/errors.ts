import { UsageLimitError } from "@/lib/billing/errors";

/** Keep actionable messages, never request headers, response bodies, stacks or credentials. */
export function safeErrorDetail(error: unknown): string {
  const seen = new Set<unknown>();
  const describe = (value: unknown, depth: number): string => {
    if (depth > 3 || !value || seen.has(value)) return "";
    seen.add(value);
    if (!(value instanceof Error)) return typeof value === "string" ? value : "";
    const metadata = value as Error & { statusCode?: unknown; code?: unknown };
    const status = typeof metadata.statusCode === "number" ? ` (HTTP ${metadata.statusCode})` : "";
    const code = typeof metadata.code === "string" && /^[A-Z_0-9]{1,40}$/.test(metadata.code) ? ` [${metadata.code}]` : "";
    const causes = value instanceof AggregateError ? value.errors : [value.cause];
    return [value.message + status + code, ...causes.slice(0, 4).map(cause => describe(cause, depth + 1))].filter(Boolean).join("\nCaused by: ");
  };
  let detail = describe(error, 0) || "An unexpected error occurred.";
  // Redact configured credentials even when a provider prints their value without a label.
  for (const [name, value] of Object.entries(process.env)) {
    if (value && value.length >= 6 && /(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name)) detail = detail.split(value).join("[redacted]");
  }
  return detail
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, "[redacted]")
    .replace(/\b(?:Bearer|Basic)\s+[^\s,;"']+/gi, "[redacted authorization]")
    .replace(/(["']?(?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|authorization|password|secret|token)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, "$1[redacted]")
    .replace(/https?:\/\/[^\s<>"']+/gi, value => {
      try { const url = new URL(value); return `${url.origin}${url.pathname}${url.search ? "?[redacted]" : ""}`; } catch { return "[redacted URL]"; }
    })
    .replace(/\b(?:sk-[A-Za-z0-9_-]+|chippy_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, "[redacted]")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .slice(0, 2400);
}

export function taskFailure(stage: string, error: unknown): string {
  if (error instanceof UsageLimitError) {
    return `${stage}: ${error.reason === "insufficient_balance" ? "Insufficient credits" : "Chat allowance exhausted"}. Review your usage and plan at /billing.`;
  }
  return `${stage}\n${safeErrorDetail(error)}`;
}
