/**
 * Calls every MCP tool against its real upstream, then renders each result in
 * the service's MCP App in Chromium. Inputs live in mcp/live-checks.ts.
 *
 *   bun run live-check [--state <file>] [--threshold <n>] [--only <service|tool>] [--no-apps]
 *
 * With --state, failures are counted across runs in that JSON file. A check
 * that fails --threshold runs in a row (default 3) is reported to Telegram
 * once, and again when it recovers. Telegram needs TELEGRAM_BOT_TOKEN and
 * TELEGRAM_CHAT_ID; without them the report is only printed. Exits 1 when any
 * check failed in this run. CHROMIUM_PATH overrides the browser Playwright launches.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { chromium, type Browser } from "@playwright/test";
import { services } from "@/generated/registry";
import { liveCases, type CallTool } from "@/mcp/live-checks";
import { appHtml, appStructuredContent, hasApp } from "@/lib/mcp/apps";
import { executeTool, type ToolResult } from "@/lib/mcp/runtime";
import type { ServiceDefinition, ToolDefinition, ToolInput } from "@/lib/mcp/types";
import { callTelegram, splitMessage } from "@/lib/telegram/api";

const { values: args } = parseArgs({
  options: {
    state: { type: "string" },
    threshold: { type: "string", default: "3" },
    only: { type: "string" },
    "no-apps": { type: "boolean", default: false },
  },
});
const threshold = Math.max(1, Number(args.threshold) || 3);

const ATTEMPTS = 3;
const TIMEOUT_MS = 45_000;

type Check = { id: string; service: string; ok: boolean; error?: string; ms: number };

const toolsByName = new Map(services.flatMap((service) => service.tools.map((tool) => [tool.name, { service, tool }] as const)));

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms)));
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

const callTool: CallTool = (name, input) => {
  const entry = toolsByName.get(name);
  if (!entry) throw new Error(`No tool named ${name}`);
  return withTimeout(executeTool(entry.service, entry.tool, input), TIMEOUT_MS, name);
};

/** One attempt: resolve the input, call the tool, apply the case's check. */
async function attempt(tool: ToolDefinition): Promise<{ input: ToolInput; result: ToolResult }> {
  const testCase = liveCases[tool.name];
  if (!testCase) throw new Error(`No live check input in mcp/live-checks.ts`);
  const input = typeof testCase.input === "function" ? await testCase.input(callTool) : testCase.input;
  const result = await callTool(tool.name, input);
  const problem = testCase.check?.(result);
  if (problem) throw new Error(problem);
  return { input, result };
}

async function runTool(service: ServiceDefinition, tool: ToolDefinition) {
  const started = Date.now();
  let error = "";
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      const { input, result } = await attempt(tool);
      return { check: { id: `tool:${tool.name}`, service: service.id, ok: true, ms: Date.now() - started } satisfies Check, input, result };
    } catch (caught) {
      error = message(caught);
      if (i < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 2_000 * i));
    }
  }
  return { check: { id: `tool:${tool.name}`, service: service.id, ok: false, error, ms: Date.now() - started } satisfies Check };
}

/** A minimal MCP Apps host: answers the handshake, then pushes the tool input and result. */
function hostPage(html: string, input: ToolInput, result: unknown) {
  const srcdoc = html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const payload = JSON.stringify({ input, result }).replace(/</g, "\\u003c");
  return `<!doctype html><html><body>
<iframe id="view" sandbox="allow-scripts" style="width:420px;height:800px;border:0" srcdoc="${srcdoc}"></iframe>
<script>
const { input, result } = ${payload};
const frame = document.getElementById("view");
const send = (message) => frame.contentWindow.postMessage({ jsonrpc: "2.0", ...message }, "*");
window.addEventListener("message", (event) => {
  if (event.source !== frame.contentWindow) return;
  const message = event.data || {};
  if (message.method === "ui/initialize") {
    send({ id: message.id, result: { protocolVersion: message.params.protocolVersion, hostInfo: { name: "live-check", version: "1" }, hostCapabilities: {}, hostContext: { theme: "light", locale: "en" } } });
  } else if (message.method === "ui/notifications/initialized") {
    send({ method: "ui/notifications/tool-input", params: { arguments: input } });
    send({ method: "ui/notifications/tool-result", params: result });
  } else if (message.id !== undefined && message.method) {
    send({ id: message.id, result: {} });
  }
});
</script></body></html>`;
}

async function runApp(browser: Browser, service: ServiceDefinition, tool: ToolDefinition, input: ToolInput, result: ToolResult): Promise<Check> {
  const started = Date.now();
  const id = `app:${tool.name}`;
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (entry) => {
    // Images an upstream no longer serves aren't the app's fault.
    if (entry.type() === "error" && !entry.text().startsWith("Failed to load resource")) errors.push(entry.text());
  });
  try {
    const callResult = {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: appStructuredContent(service, tool, input)(result),
    };
    await page.setContent(hostPage(appHtml(service), input, callResult));
    const root = page.frameLocator("#view").locator("#app");
    await root.and(page.frameLocator("#view").locator('[data-status="ready"]')).waitFor({ timeout: 15_000 });
    // Console events arrive asynchronously; give a render error time to surface.
    await page.waitForTimeout(300);
    if ((await root.innerText()).trim() === "") errors.push("Rendered nothing");
    return { id, service: service.id, ok: errors.length === 0, error: errors.length ? errors.join("; ").slice(0, 500) : undefined, ms: Date.now() - started };
  } catch (caught) {
    return { id, service: service.id, ok: false, error: [message(caught), ...errors].join("; ").slice(0, 500), ms: Date.now() - started };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- run

const selected = services
  .map((service) => ({ service, tools: service.tools.filter((tool) => !args.only || args.only === service.id || args.only === tool.name) }))
  .filter((entry) => entry.tools.length > 0);
if (selected.length === 0) throw new Error(`Nothing matches --only ${args.only}`);

const browser = args["no-apps"] ? null : await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const checks: Check[] = [];

// Services run in parallel; a service's tools run one at a time to go easy on its upstream.
await Promise.all(
  selected.map(async ({ service, tools }) => {
    for (const tool of tools) {
      const run = await runTool(service, tool);
      checks.push(run.check);
      if (browser && hasApp(service, tool) && run.result) checks.push(await runApp(browser, service, tool, run.input!, run.result));
    }
  }),
);
await browser?.close();

checks.sort((a, b) => a.id.localeCompare(b.id));
const failed = checks.filter((check) => !check.ok);
for (const check of checks) console.log(`${check.ok ? "ok  " : "FAIL"} ${check.id} (${check.ms} ms)${check.error ? ` — ${check.error}` : ""}`);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);

// ---------------------------------------------------------------- state across runs

type Entry = { failures: number; since: string; error: string; alerted: boolean };
const statePath = args.state;
const state: Record<string, Entry> = statePath && existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const now = new Date().toISOString();
const alerts: Array<Check & Entry> = [];
const recovered: Array<Check & Entry> = [];

for (const check of checks) {
  const previous = state[check.id];
  if (check.ok) {
    if (previous?.alerted) recovered.push({ ...check, ...previous });
    delete state[check.id];
    continue;
  }
  const entry: Entry = { failures: (previous?.failures ?? 0) + 1, since: previous?.since ?? now, error: check.error ?? "", alerted: previous?.alerted ?? false };
  if (entry.failures >= threshold && !entry.alerted) {
    entry.alerted = true;
    alerts.push({ ...check, ...entry });
  }
  state[check.id] = entry;
}
// A partial run (--only) leaves other checks' counts alone; a full run drops checks that no longer exist.
if (!args.only) for (const id of Object.keys(state)) if (!checks.some((check) => check.id === id)) delete state[id];

// ---------------------------------------------------------------- report

const escape = (text: string) => text.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);
const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;

function report() {
  const lines: string[] = [];
  if (alerts.length) {
    lines.push(`🔴 <b>mcprouter live check: ${alerts.length} failing</b> (${threshold}+ runs in a row)`);
    for (const alert of alerts) lines.push(`• <code>${escape(alert.id)}</code> (${escape(alert.service)}), since ${alert.since.slice(0, 16).replace("T", " ")} UTC\n  ${escape(alert.error)}`);
  }
  if (recovered.length) {
    if (lines.length) lines.push("");
    lines.push(`🟢 <b>Recovered: ${recovered.length}</b>`);
    for (const check of recovered) lines.push(`• <code>${escape(check.id)}</code> (${escape(check.service)}) after ${check.failures} failed runs`);
  }
  if (runUrl) lines.push("", `<a href="${runUrl}">Workflow run</a>`);
  return lines.join("\n");
}

let notified = true;
if (alerts.length || recovered.length) {
  const text = report();
  console.log(`\n${text}`);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  let sent = false;
  if (!botToken || !chatId) {
    console.warn("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set; not notifying.");
  } else {
    try {
      for (const part of splitMessage(text)) {
        await callTelegram({ botToken }, "sendMessage", { chat_id: chatId, text: part, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
      }
      sent = true;
    } catch (error) {
      notified = false;
      console.error("Telegram notification failed:", error);
    }
  }
  // Alert again next run.
  if (!sent) for (const alert of alerts) state[alert.id].alerted = false;
}

if (statePath) writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = checks.map((check) => {
    const streak = state[check.id]?.failures;
    return `| ${check.ok ? "✅" : "❌"} | \`${check.id}\` | ${check.service} | ${streak ?? ""} | ${(check.error ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")} |`;
  });
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [`## Live check: ${checks.length - failed.length}/${checks.length} passed`, "", "| | Check | Service | Failed runs in a row | Error |", "|---|---|---|---|---|", ...rows, ""].join("\n"),
  );
}

process.exit(failed.length > 0 || !notified ? 1 : 0);
