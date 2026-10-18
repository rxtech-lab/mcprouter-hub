/**
 * Shared runtime for every mcprouter MCP App (SEP-1865, `io.modelcontextprotocol/ui`).
 *
 * Runs inside the host's sandboxed iframe. It speaks the View side of the
 * protocol over postMessage JSON-RPC: the `ui/initialize` handshake, tool
 * input and result notifications, size reporting, and the requests an app can
 * make of the host (`tools/call`, `ui/open-link`, `ui/message`).
 *
 * A service's `app.ts` imports this module and calls `mount({ render })`;
 * `scripts/codegen.ts` bundles the two into one browser script for the
 * resource HTML. Text from upstream APIs is only ever set with textContent,
 * never parsed as HTML.
 */

const PROTOCOL_VERSION = "2026-01-26";
const TIME_ZONE = "Asia/Hong_Kong";

/** Upstream JSON. Each API has its own shape, so apps read fields defensively. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;

export type Lang = "en" | "tc" | "sc";

type CallToolResult = {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type HostContext = {
  theme?: "light" | "dark";
  locale?: string;
  styles?: { variables?: Record<string, string> };
  toolInfo?: { id?: string | number; tool?: { name?: string } };
  [key: string]: unknown;
};

type Parsed = { tool?: string; input?: Row; data?: Row; meta?: Meta; error?: string };

export type Meta = { source?: string; total?: number; returned?: number; truncated?: boolean };

export type View = {
  /** "loading": the input is known and the result is pending. Errors and the waiting state are drawn by the runtime. */
  status: "waiting" | "loading" | "ready" | "error" | "cancelled";
  tool?: string;
  input: Row;
  data: Row;
  meta: Meta;
  error?: string;
};

export type Content = Node | string | null | undefined | false | Content[];

// ---------------------------------------------------------------- bridge

let nextId = 1;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
const state: {
  input: Row;
  result: CallToolResult | undefined;
  cancelled: boolean;
  hostContext: HostContext;
  hostCapabilities: Record<string, unknown>;
} = { input: undefined, result: undefined, cancelled: false, hostContext: {}, hostCapabilities: {} };
let mounted: MountOptions | null = null;
const timers: ReturnType<typeof setInterval>[] = [];

function post(message: Record<string, unknown>) {
  window.parent.postMessage(message, "*");
}

function request<T = unknown>(method: string, params?: unknown, timeoutMs?: number): Promise<T> {
  const id = nextId++;
  post({ jsonrpc: "2.0", id, method, params: params ?? {} });
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    if (timeoutMs) {
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`${method} timed out`));
      }, timeoutMs);
    }
  });
}

function notify(method: string, params?: unknown) {
  post({ jsonrpc: "2.0", method, params: params ?? {} });
}

function respond(id: unknown, result: unknown = {}) {
  post({ jsonrpc: "2.0", id, result });
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  const message = event.data;
  if (!message || message.jsonrpc !== "2.0") return;

  if (message.id !== undefined && !message.method) {
    const waiting = pending.get(message.id);
    if (!waiting) return;
    pending.delete(message.id);
    if (message.error) waiting.reject(new Error(message.error.message || "Request failed"));
    else waiting.resolve(message.result);
    return;
  }

  switch (message.method) {
    case "ui/notifications/tool-input":
    case "ui/notifications/tool-input-partial":
      state.input = message.params?.arguments ?? {};
      render();
      break;
    case "ui/notifications/tool-result":
      state.result = message.params;
      render();
      break;
    case "ui/notifications/tool-cancelled":
      state.cancelled = true;
      render();
      break;
    case "ui/notifications/host-context-changed":
      state.hostContext = { ...state.hostContext, ...message.params };
      applyHostContext();
      render();
      break;
    case "ui/resource-teardown":
      timers.forEach(clearInterval);
      respond(message.id);
      break;
    case "ping":
      respond(message.id);
      break;
    default:
      if (message.id !== undefined) post({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } });
  }
});

function applyHostContext() {
  const context = state.hostContext;
  const root = document.documentElement;
  if (context.theme === "light" || context.theme === "dark") root.dataset.theme = context.theme;
  const variables = context.styles?.variables;
  if (variables && typeof variables === "object") {
    for (const [name, value] of Object.entries(variables)) {
      if (name.startsWith("--") && typeof value === "string") root.style.setProperty(name, value);
    }
  }
  if (context.locale) root.lang = String(context.locale);
}

// Report the document height so the host can size the iframe to fit.
let lastHeight = 0;
function reportSize() {
  const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
  if (height === lastHeight) return;
  lastHeight = height;
  notify("ui/notifications/size-changed", { height });
}

// ---------------------------------------------------------------- results

function resultText(result: CallToolResult) {
  return (result.content ?? [])
    .filter((part) => part?.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
}

/** A CallToolResult as `{ tool, input, data, meta }`, or `{ error }`. */
function parseResult(result: CallToolResult | undefined): Parsed | null {
  if (!result) return null;
  if (result.isError) return { error: resultText(result) || "The tool failed." };
  const structured = result.structuredContent as Row;
  if (structured && typeof structured === "object") {
    return { tool: structured.tool, input: structured.input, data: "data" in structured ? structured.data : structured, meta: structured.meta ?? {} };
  }
  const text = resultText(result);
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && "data" in parsed) return { data: parsed.data, meta: parsed.meta ?? {} };
    return { data: parsed, meta: {} };
  } catch {
    return { data: text, meta: {} };
  }
}

function currentView(): View {
  const parsed = parseResult(state.result);
  const tool = parsed?.tool ?? state.hostContext.toolInfo?.tool?.name;
  const input = parsed?.input ?? state.input ?? {};
  let status: View["status"] = "waiting";
  if (parsed?.error) status = "error";
  else if (parsed) status = "ready";
  else if (state.cancelled) status = "cancelled";
  else if (state.input !== undefined) status = "loading";
  return { status, tool, input, data: parsed?.data, meta: parsed?.meta ?? {}, error: parsed?.error };
}

// ---------------------------------------------------------------- app api

export const app = {
  /** Whether the host lets the app call tools (`hostCapabilities.serverTools`). */
  get canCallTools() {
    return Boolean(state.hostCapabilities.serverTools);
  },
  /** The language of the result: the tool's `lang` input, else the host locale. */
  get lang(): Lang {
    const lang = state.input?.lang;
    if (lang === "tc" || lang === "sc") return lang;
    const locale = String(state.hostContext.locale ?? "");
    if (/^zh/i.test(locale)) return /hans|cn|sg/i.test(locale) ? "sc" : "tc";
    return "en";
  },
  /** Calls a tool of this service through the host. Resolves to `{ data, meta }` or `{ error }`. */
  callTool(name: string, args: Record<string, unknown> = {}): Promise<Parsed> {
    return request<CallToolResult>("tools/call", { name, arguments: args }, 30_000).then(
      (result) => parseResult(result) ?? { error: "No result" },
      (error: Error) => ({ error: error.message }),
    );
  },
  /** Re-runs the tool that produced this result and shows the fresh data. */
  async refresh() {
    const view = currentView();
    if (!view.tool) return;
    try {
      const result = await request<CallToolResult>("tools/call", { name: view.tool, arguments: view.input }, 30_000);
      if (result && !result.isError) state.result = result;
    } finally {
      render();
    }
  },
  openLink(url: string) {
    return request("ui/open-link", { url }).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  },
  /** Asks a follow-up in the conversation, as if the user typed it. */
  sendMessage(text: string) {
    return request("ui/message", { role: "user", content: [{ type: "text", text }] }).catch(() => {});
  },
  rerender() {
    render();
  },
  /** Re-render on an interval, e.g. so "3 min" counts down. */
  every(ms: number) {
    if (!timers.length) timers.push(setInterval(render, ms));
  },
};

export type App = typeof app;

// ---------------------------------------------------------------- dom

type Props = Record<string, unknown> | null;

/** h("div", { class: "row", onclick: fn }, child, "text", [more]) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props, ...children: Content[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") element.addEventListener(key.slice(2), value as EventListener);
    else if (key === "class") element.className = String(value);
    else if (key === "style" && typeof value === "object") Object.assign(element.style, value);
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  append(element, children);
  return element;
}

function append(parent: Node, children: Content[]) {
  for (const child of children) {
    if (child === undefined || child === null || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Material Symbols paths (24px grid). Static strings, so setting them as markup is safe.
const ICONS = {
  refresh: "M12 20q-3.35 0-5.675-2.325T4 12t2.325-5.675T12 4q1.725 0 3.3.712T18 6.75V4h2v7h-7V9h4.2q-.8-1.4-2.187-2.2T12 6Q9.5 6 7.75 7.75T6 12t1.75 4.25T12 18q1.925 0 3.475-1.1T17.65 14h2.1q-.7 2.65-2.85 4.325T12 20",
  open: "M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h7v2H5v14h14v-7h2v7q0 .825-.587 1.413T19 21zm4.7-5.3-1.4-1.4L17.6 5H14V3h7v7h-2V6.4z",
  place: "M12 12q.825 0 1.413-.587T14 10t-.587-1.412T12 8t-1.412.588T10 10t.588 1.413T12 12m0 10q-4.025-3.425-6.012-6.362T4 10.2q0-3.75 2.413-5.975T12 2t5.588 2.225T20 10.2q0 2.5-1.987 5.438T12 22",
  ask: "M6 14h8v-2H6zm0-3h12V9H6zm0-3h12V6H6zM2 22V4q0-.825.588-1.412T4 2h16q.825 0 1.413.588T22 4v12q0 .825-.587 1.413T20 18H6z",
  check: "m9.55 18-5.7-5.7 1.425-1.425L9.55 15.15l9.175-9.175L20.15 7.4z",
  warning: "M1 21 12 2l11 19zm11-3q.425 0 .713-.288T13 17t-.288-.712T12 16t-.712.288T11 17t.288.713T12 18m-1-3h2v-5h-2z",
  info: "M11 17h2v-6h-2zm1-8q.425 0 .713-.288T13 8t-.288-.712T12 7t-.712.288T11 8t.288.713T12 9m0 13q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22",
};

export type IconName = keyof typeof ICONS;

function icon(name: IconName, size = 18) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("d", ICONS[name]);
  svg.appendChild(path);
  return svg;
}

// ---------------------------------------------------------------- format

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "string" || !value) return null;
  // "2026-10-18 08:34:10" (MTR, car parks) is Hong Kong local time.
  const normalised = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value) ? `${value.replace(" ", "T")}+08:00` : value;
  const date = new Date(normalised);
  return isNaN(date.getTime()) ? null : date;
}

export const fmt = {
  date: toDate,
  /** 08:41, in Hong Kong time. */
  time(value: unknown) {
    const date = toDate(value);
    return date ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(date) : "";
  },
  /** Sun 18 Oct */
  day(value: unknown, options?: Intl.DateTimeFormatOptions) {
    const date = toDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE, ...options }).format(date);
  },
  dateTime(value: unknown) {
    const date = toDate(value);
    return date ? `${fmt.day(date)}, ${fmt.time(date)}` : "";
  },
  minutesUntil(value: unknown) {
    const date = toDate(value);
    return date ? Math.round((date.getTime() - Date.now()) / 60_000) : null;
  },
  /** "Arriving", "3 min", or "" when the time has passed or is missing. */
  eta(value: unknown) {
    const minutes = fmt.minutesUntil(value);
    if (minutes === null || minutes < -1) return "";
    return minutes <= 0 ? "Arriving" : `${minutes} min`;
  },
  ago(value: unknown) {
    const date = toDate(value);
    if (!date) return "";
    const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours} h ago` : fmt.day(date);
  },
  /** A localised field: pick(stop, "name") reads name_en, name_tc or name_sc. */
  pick(item: Row, base: string, lang: Lang = app.lang): string {
    if (!item) return "";
    return item[`${base}_${lang}`] || item[`${base}_en`] || item[`${base}_tc`] || item[base] || "";
  },
  /** Upstream names are often SHOUTED; soften them for display. */
  title(text: string) {
    if (typeof text !== "string" || text !== text.toUpperCase() || !/[A-Z]{3}/.test(text)) return text;
    return text.toLowerCase().replace(/(^|[\s(\-/])([a-z])/g, (_, space: string, letter: string) => space + letter.toUpperCase());
  },
};

// ---------------------------------------------------------------- components

export type Tone = "accent" | "info" | "success" | "warning" | "danger";

type RowOptions = { leading?: Content; title: Content; subtitle?: Content; trailing?: Content; onclick?: () => void; hint?: string };

function list(items: Content[]) {
  return h("ul", { class: "list" }, items.map((item, index) => h("li", { style: { animationDelay: `${Math.min(index, 12) * 30}ms` } }, item)));
}

function button(label: string, onclick: () => void, options: { variant?: "tonal" | "text" | "icon"; icon?: IconName; title?: string } = {}) {
  return h(
    "button",
    { type: "button", class: `button button-${options.variant ?? "tonal"}`, onclick, title: options.title, "aria-label": options.icon && !label ? options.title : undefined },
    options.icon ? icon(options.icon, 16) : null,
    label ? h("span", null, label) : null,
  );
}

function linkButton(label: string, url: string | undefined | null, iconName: IconName = "open") {
  if (!url) return null;
  return button(label, () => void app.openLink(url), { icon: iconName, variant: "text", title: url });
}

function kv(entries: Array<[string, Content] | null>) {
  return h(
    "dl",
    { class: "kv" },
    entries
      .filter((entry): entry is [string, Content] => Boolean(entry) && entry![1] !== undefined && entry![1] !== null && entry![1] !== "")
      .map(([label, value]) => h("div", null, h("dt", null, label), h("dd", null, value))),
  );
}

function section(title: string | null, ...children: Content[]) {
  return h("section", { class: "section" }, title ? h("h2", { class: "section-title" }, title) : null, children);
}

function chip(text: string, tone?: Tone | null) {
  return h("span", { class: `chip${tone ? ` chip-${tone}` : ""}` }, text);
}

function empty(text: string) {
  return h("div", { class: "empty" }, text);
}

function table(rows: Row[], columns?: Array<string | number> | null, limit = 50) {
  const isArrays = Array.isArray(rows[0]);
  let shownColumns = columns;
  if (!shownColumns) {
    if (isArrays) shownColumns = (rows[0] as unknown[]).map((_, index) => index);
    else {
      const keys: string[] = [];
      for (const row of rows.slice(0, 20)) {
        for (const key of Object.keys(row ?? {})) if (!keys.includes(key) && typeof row[key] !== "object") keys.push(key);
      }
      shownColumns = keys.slice(0, 8);
    }
  }
  const shown = rows.slice(0, limit);
  return h(
    "div",
    { class: "table-wrap" },
    h(
      "table",
      { class: "table" },
      isArrays ? null : h("thead", null, h("tr", null, shownColumns.map((column) => h("th", null, String(column))))),
      h("tbody", null, shown.map((row) => h("tr", null, shownColumns!.map((column) => {
        const value = row?.[column];
        return h("td", null, value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value));
      })))),
    ),
    rows.length > shown.length ? h("p", { class: "footer" }, `Showing ${shown.length} of ${rows.length} rows`) : null,
  );
}

/** Best-effort view of any JSON, for tools without a dedicated layout. */
function generic(data: Row): Content {
  if (data === null || data === undefined || data === "") return empty("No data.");
  if (typeof data !== "object") return h("p", { class: "prose" }, String(data));
  if (Array.isArray(data)) {
    if (!data.length) return empty("No results.");
    if (typeof data[0] !== "object") return h("div", { class: "chips" }, data.slice(0, 60).map((item) => chip(String(item))));
    return table(data);
  }
  const nested: string[] = [];
  const flat: Array<[string, Content]> = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value && typeof value === "object") nested.push(key);
    else flat.push([key, value === true ? "Yes" : value === false ? "No" : (value as string)]);
  }
  return h("div", null, flat.length ? kv(flat) : null, nested.map((key) => section(key, generic(data[key]))));
}

export const ui = {
  icon,
  section,
  chip,
  list,
  button,
  linkButton,
  kv,
  table,
  generic,
  empty,
  header(options: { badge?: Content; title: Content; subtitle?: Content; actions?: Content[] }) {
    return h(
      "header",
      { class: "header" },
      options.badge ? h("span", { class: "header-badge" }, options.badge) : null,
      h("div", { class: "header-text" }, h("h1", { class: "title" }, options.title), options.subtitle ? h("p", { class: "subtitle" }, options.subtitle) : null),
      options.actions?.some(Boolean) ? h("div", { class: "header-actions" }, options.actions) : null,
    );
  },
  badge(text: string, style?: Partial<CSSStyleDeclaration>) {
    return h("span", { class: "badge", style }, text);
  },
  row(options: RowOptions) {
    const body = [
      options.leading ? h("span", { class: "row-leading" }, options.leading) : null,
      h("span", { class: "row-text" }, h("span", { class: "row-title" }, options.title), options.subtitle ? h("span", { class: "row-subtitle" }, options.subtitle) : null),
      options.trailing ? h("span", { class: "row-trailing" }, options.trailing) : null,
    ];
    return options.onclick
      ? h("button", { type: "button", class: "row row-action", onclick: options.onclick, title: options.hint }, body)
      : h("div", { class: "row" }, body);
  },
  /** A list that shows `limit` items and folds the rest behind "Show all". */
  more(items: Content[], limit: number, label?: string) {
    if (items.length <= limit) return list(items);
    return h(
      "div",
      null,
      list(items.slice(0, limit)),
      h("details", { class: "more" }, h("summary", null, `Show all ${items.length}${label ? ` ${label}` : ""}`), list(items.slice(limit))),
    );
  },
  /** Re-runs the tool; only offered when the host lets the app call tools. */
  refreshButton() {
    if (!app.canCallTools) return null;
    const refresh = button(
      "",
      () => {
        refresh.disabled = true;
        refresh.classList.add("spinning");
        void app.refresh();
      },
      { icon: "refresh", variant: "icon", title: "Refresh" },
    );
    return refresh;
  },
  /** Asks a follow-up question in the chat. */
  askButton(label: string, question: string) {
    return button(label, () => void app.sendMessage(question), { icon: "ask", variant: "text", title: question });
  },
  mapButton(lat: unknown, lon: unknown, label = "Map") {
    if (typeof lat !== "number" || typeof lon !== "number" || !isFinite(lat) || !isFinite(lon)) return null;
    return linkButton(label, `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`, "place");
  },
  notice(text: string, tone: Exclude<Tone, "accent"> = "info") {
    return h(
      "div",
      { class: `notice notice-${tone}`, role: tone === "danger" ? "alert" : undefined },
      icon(tone === "success" ? "check" : tone === "info" ? "info" : "warning", 18),
      h("span", null, text),
    );
  },
  skeleton(lines = 3) {
    return h("div", { class: "skeleton-group", "aria-label": "Loading" }, Array.from({ length: lines }, (_, index) => h("div", { class: "skeleton", style: { width: `${90 - index * 15}%` } })));
  },
  /** "Updated 08:34 · Showing 100 of 412" under the result. */
  footer(view: View, extra?: string | null) {
    const parts: string[] = [];
    if (extra) parts.push(extra);
    if (view.meta.truncated) parts.push(`Showing ${view.meta.returned} of ${view.meta.total}`);
    return parts.length ? h("footer", { class: "footer" }, parts.join(" · ")) : null;
  },
  /** Next arrivals as "3 min" chips; the first one is highlighted. */
  etaChips(etas: Array<{ eta: unknown; remark?: string }>) {
    const shown = etas.map((eta) => ({ label: fmt.eta(eta.eta), remark: eta.remark, time: fmt.time(eta.eta) })).filter((eta) => eta.label);
    if (!shown.length) return h("span", { class: "muted" }, etas[0]?.remark || "No departures");
    return h(
      "span",
      { class: "etas" },
      shown.slice(0, 3).map((eta, index) => h("span", { class: `eta${index === 0 ? " eta-next" : ""}`, title: [eta.time, eta.remark].filter(Boolean).join(" · ") }, eta.label)),
    );
  },
};

// ---------------------------------------------------------------- render

function render() {
  if (!mounted) return;
  const root = document.getElementById("app")!;
  const view = currentView();
  let content: Content;
  try {
    if (view.status === "error") content = ui.notice(view.error ?? "The tool failed.", "danger");
    else if (view.status === "cancelled") content = empty("The tool call was cancelled.");
    else if (view.status === "waiting") content = ui.skeleton(3);
    else content = mounted.render(view);
  } catch (error) {
    console.error(error);
    content = generic(view.data);
  }
  root.replaceChildren();
  append(root, [content]);
  root.dataset.status = view.status;
  reportSize();
}

/** Sets the provider's brand colour, used by badges, the next arrival and bars. */
export function setAccent(accent: string, onAccent = "#ffffff") {
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--on-accent", onAccent);
}

type MountOptions = {
  accent?: string;
  onAccent?: string;
  render: (view: View) => Content;
};

/** Starts the app: draws the waiting state, then performs the `ui/initialize` handshake. */
export function mount(options: MountOptions) {
  mounted = options;
  if (options.accent) setAccent(options.accent, options.onAccent);
  new ResizeObserver(reportSize).observe(document.documentElement);
  render();
  request<{ hostContext?: HostContext; hostCapabilities?: Record<string, unknown> }>(
    "ui/initialize",
    {
      protocolVersion: PROTOCOL_VERSION,
      appInfo: { name: `mcprouter-${document.body.dataset.service ?? "app"}`, version: "1.0.0" },
      appCapabilities: { availableDisplayModes: ["inline"] },
    },
    10_000,
  )
    .then((result) => {
      state.hostContext = result?.hostContext ?? {};
      state.hostCapabilities = result?.hostCapabilities ?? {};
      applyHostContext();
      notify("ui/notifications/initialized");
      render();
    })
    .catch((error) => console.warn("[mcp-app] host did not initialize", error));
}
