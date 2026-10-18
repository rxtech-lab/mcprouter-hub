# mcprouter

Hong Kong open data (DATA.GOV.HK) as MCP tools, with RxLab sign-in, rx-subscription billing, a Material 3 dashboard, an AI agent and a conversion tracker.

## Quick start

```sh
bun install
cp .env.example .env.local      # set DEV_BYPASS_AUTH=true and AUTH_SECRET for local work
bunx drizzle-kit migrate        # creates local.db
bun run catalog:sync            # optional: load the 3,830-dataset catalogue for the tracker
bun run dev
```

Step-by-step setup for Claude Code, Claude (web, Desktop, mobile), ChatGPT, Codex, Gemini CLI and Cursor opens as a dialog on `/keys/apps` (`?client=<id>&auth=key` picks the client and API-key flow). Clients that support OAuth sign in on their own; for the rest, create a key at `/keys`, then point any MCP client at `http://localhost:3000/api/mcp/streamable` with `Authorization: Bearer mcpr_…`.
To inspect it: `bunx @modelcontextprotocol/inspector` with that URL and header.

## Endpoints

| Path | What |
|---|---|
| `/api/mcp/streamable` | Every service (Streamable HTTP, stateless) |
| `/api/mcp/s/<service>/streamable` | One service, for a smaller tool list |
| `/api/chat` | The agent (AI SDK 7), used by `/chat` |
| `/api/whatsapp` | WhatsApp bot webhook (WasenderAPI) |
| `/api/telegram` | Telegram bot webhook (Bot API) |
| `/api/cron/sync-catalog` | Daily catalogue sync (Vercel cron, `CRON_SECRET`) |

Keys arrive as a Bearer header or `?token=`. They're stored as a sha256 hash, can be limited to services, and every call is metered against rx-subscription when `BILLING_ENABLED=true`. With `RX_SUBSCRIPTION_CREDIT_UNIT` set, each call (including the dashboard agent's) first takes 1 from that balance (`POST /api/v1/balances`, refused when empty) and is then tracked on the usage item `RX_SUBSCRIPTION_USAGE_ITEM` (`POST /api/v1/usage`); without it, the usage item's plan allowance is the gate. rx-subscription keeps the usage log; the Usage pages read it back from `/api/v1/usage/statistics` and `/api/v1/balances/ledger`.

### OAuth

Besides API keys, both MCP endpoints accept OAuth 2.1 access tokens, so clients like Claude Code, Claude Desktop and ChatGPT only need the URL. mcprouter is its own authorization server; sign-in reuses the normal RxLab session, so no extra RxAuth client is needed.

1. An unauthenticated call gets `401` with `WWW-Authenticate: Bearer resource_metadata="<site>/.well-known/oauth-protected-resource/<endpoint path>"` (RFC 9728). The metadata names the endpoint as the `resource`.
2. `/.well-known/oauth-authorization-server` (RFC 8414) lists the endpoints below. Only public clients, the `authorization_code` + `refresh_token` grants, and S256 PKCE are supported.
3. `POST /api/mcp/oauth/register` (RFC 7591 dynamic registration) accepts HTTPS, loopback (any port) and private-use app-scheme redirect URIs, up to 60 registrations a minute.
4. `/oauth/authorize` sends signed-out users to `/login?next=…`, then shows a consent page. Allow/Cancel is a server action that validates the request again and redirects back with `code`, `state` and `iss` (RFC 9207).
5. `POST /api/mcp/oauth/token` exchanges the code (one minute, single use; replaying it revokes the grant) and rotates refresh tokens (reusing one revokes the grant). Access tokens (`mcpo_at_…`) last an hour. The grant expires after 30 days without a refresh. `POST /api/mcp/oauth/revoke` follows RFC 7009.

A token is bound to the `resource` the user approved: a token for `/api/mcp/streamable` works on every endpoint, and a token for `/api/mcp/s/<service>/streamable` only works on that endpoint. OAuth tokens are accepted only in the `Authorization` header. Calls are billed and logged like key calls (with no `apiKeyId`). Users see and disconnect apps under **API keys → Connected apps** (`/keys/apps`). Codes, tokens and grants are stored as sha256 hashes in `oauth_*` tables (migration `0003_oauth`). The daily cron removes expired and revoked ones. The issuer is `NEXT_PUBLIC_SITE_URL`, so set it to the public origin in production.

## Adding an MCP service

1. Create `mcp/services/<id>/service.yaml` (schema: `mcp/schema.ts`; `mcp/services/hk-bus/service.yaml` is a good template).
2. For anything YAML can't express, set `handler: name` on the tool and export `name` from `mcp/services/<id>/handlers.ts`. When only the HTTP call or its body needs code, keep the YAML request and add `transform` instead (see below).
3. Run `bun run codegen` (also runs on `bun install`, `dev` and `build`). `generated/` is gitignored.

List the service's CKAN dataset ids under `datasets:`; the tracker counts them as converted. List the [API tracker](#api-tracker) ids it implements under `apis:`.

### YAML in brief

```yaml
id: example
title: Example
datasets: [some-ckan-id]
baseUrl: https://api.example.gov.hk
lang: { param: lang, map: { en: en, tc: tc, sc: sc } }   # applied to any input named `lang`
cacheTtl: 300                                             # seconds, per tool via cacheTtl too
tools:
  - name: example_thing
    description: What the model sees.
    path: /things/{id}            # {id} is filled from the `id` input
    query: { type: fixed }        # sent on every call
    input:
      id: { type: string, required: true }
      q: { type: string, in: local }   # used only by response.search, never sent upstream
    response:
      format: json                # json | xml | csv | text (BOMs are stripped)
      root: data                  # dot path into the body
      search: { input: q, fields: [name_en, name_tc] }
      filter: { route: route }    # item field → input name, exact match
      pick: [id, name_en]
      limit: 100
    transform:                    # optional; exports from handlers.ts, not allowed with `handler`
      request: signRequest        # (request, input, context) => request, before the fetch
      response: unwrapFeed        # (body, input, context) => body, before `response` shaping
```

A request transformer gets the built `{ url, method, body, headers }` and returns the request to send (it must stay http(s) GET/POST). The cache is keyed by that final request and holds the raw body, so the response transformer runs on every call, including cache hits. Both get the same `context` as handlers (`service`, `tool`, `fetchUpstream`). Types: `RequestTransformer` and `ResponseTransformer` in `lib/mcp/types.ts`.

### MCP Apps (result UI)

A service can show its results as an [MCP App](https://modelcontextprotocol.io/docs/extensions/apps) (`io.modelcontextprotocol/ui`): add `app:` to the YAML and write `mcp/services/<id>/app.ts`. Codegen bundles it with the shared runtime (`mcp/apps/runtime.ts`, styles in `mcp/apps/styles.css`) into one HTML resource, `ui://mcprouter/<id>`, and every tool of the service points at it through `_meta.ui.resourceUri` (opt a tool out with `app: false`). Results also carry `structuredContent` (`{ service, tool, input, data, meta }`), which the app renders and the model never sees; hosts without MCP Apps still get the JSON text.

```yaml
app:
  resourceDomains: ["https://www.hko.gov.hk"]   # optional; origins the app may load images from
  connectDomains: []                            # optional; origins it may fetch from (prefer tools/call)
```

```ts
import { mount, ui, type View } from "../../apps/runtime";

mount({
  accent: "#ac2e44", // the provider's brand colour
  render: (view: View) => (view.tool === "my_tool" ? [ui.header({ title: "…" }), ui.generic(view.data)] : ui.generic(view.data)),
});
```

`app.callTool`, `app.refresh`, `app.openLink` and `app.sendMessage` go through the host. In this app's chat they work for members (and are billed); visitors' apps can only open links and ask follow-ups.

## API tracker

[`mcp/apis.yaml`](mcp/apis.yaml) is the single source of truth for the upstream APIs mcprouter serves or plans to serve. Each entry has a permanent id (`API-0001`, `API-0002`, …); new APIs go at the end with the next number, and ids are never reused or renumbered. Status isn't written there: an API is **implemented** when a service YAML lists its id under `apis:`, and **coming soon** otherwise. A pull request that implements an API puts its id in the title, e.g. `feat(mcp): add AQHI (API-0031)`.

`bun run codegen` checks the two agree (unknown or out-of-order ids, a service without `apis:`, or datasets that don't match fail the build) and writes [`APIS.md`](APIS.md), the tracker as a table, and `generated/apis.json`, which the public **Data sources → APIs** page (`/sources/apis`) reads. Commit `APIS.md` with the YAML change; a test fails when it's stale.

## Translations

The UI is in English, Simplified Chinese (`zh-CN`) and Traditional Chinese for Hong Kong (`zh-HK`). The language menu sits in the navigation rail and in the public top app bar. Picking a language saves it in the `locale` cookie for a year. Until the user picks one, the locale follows the browser's `Accept-Language` (`zh-HK`, `zh-TW`, `zh-MO`, `zh-Hant` and `yue` read `zh-HK`; other Chinese reads `zh-CN`; anything else reads English). URLs stay the same in every language.

Translations live in gettext catalogues, `locales/<locale>/messages.po`, keyed by the English source string:

- Server Components, server actions and `generateMetadata`: `const t = await getT()` from `@/lib/i18n/server`. Client Components: `const t = useT()` from `@/lib/i18n/client`.
- `t("Hello {name}", { name })` translates and fills placeholders. `t.plural("{count} key", "{count} keys", count)` picks by count. `t.rich("Read the <docs>guide</docs>", { docs: (chunks) => <Link href="/docs">{chunks}</Link> })` renders elements inside a sentence.
- Labels declared outside a component are marked with `msg("Overview")` and translated where they render, with `t(item.label)`.
- The first argument must be a string literal, so `bun run i18n:extract` can find it. Extraction adds new strings to every `messages.po` and drops unused ones; translators fill in each `msgstr`. Strings left untranslated, or flagged `fuzzy`, fall back to English.
- Dates and numbers: pass `t.locale` to the helpers in `lib/format.ts`.

`bun run codegen` compiles the catalogues to `generated/i18n/<locale>.json`. CI runs `bun run i18n:check`, which fails when a catalogue is out of date or has untranslated strings.

## Scripts

| Script | |
|---|---|
| `bun run codegen [--check]` | YAML → `generated/` and `APIS.md`; compiles the translation catalogues |
| `bun run i18n:extract` / `bun run i18n:check` | Update `locales/*/messages.po` from the source / check they're complete |
| `bun run theme` | Regenerate `app/m3-tokens.css` from the seed colour |
| `bun run catalog:sync [--limit N]` | Sync the CKAN catalogue without the cron's time budget |
| `bun run tracker:report [--markdown]` | Tracker summary in the terminal |
| `bun run test` / `bun run test:e2e` | vitest / Playwright (`DEV_BYPASS_AUTH`) |

## Agent

`AGENT_MCP_SERVERS` is a JSON list of `{ name, url, headers }`. `url: "self"` is this app's `/api/mcp/streamable`, called with `MCPROUTER_INTERNAL_KEY` on behalf of the signed-in user, so the agent's tool calls are billed to them. Tools from other servers are prefixed `<name>__`. The chat is an MCP Apps host: tool results with an app render in a sandboxed iframe through `/mcp-app-sandbox` (set `NEXT_PUBLIC_MCP_APP_SANDBOX_URL` to serve that page from a separate origin), and apps from other servers work too. `AI_MODEL` is an AI Gateway model string. The agent loads tools on demand: it starts with only `search_tools`, which ranks tools by embedding similarity (`AI_EMBEDDING_MODEL`, default `openai/text-embedding-3-small`) merged with keyword matches, and falls back to keywords if embedding fails.

## WhatsApp

People can chat with the agent on WhatsApp through [WasenderAPI](https://wasenderapi.com).

1. Connect a WhatsApp number as a Wasender session. Set `WASENDER_API_KEY` to the session's API key and `WASENDER_WEBHOOK_SECRET` to its webhook secret. Optionally set `WHATSAPP_BOT_NUMBER` for "Chat on WhatsApp" links.
2. Set the session's webhook URL to `https://<site>/api/whatsapp` and turn on the `messages.received` event. For local work, expose `bun run dev` with a tunnel such as `cloudflared tunnel --url http://localhost:3000`.

Every webhook must carry the secret in `X-Webhook-Signature`. It's acknowledged straight away, and the reply is generated in `after()`. The bot answers only numbers linked to an account. Any other number gets a sign-in link (`/whatsapp/link?token=…`, signed with `AUTH_SECRET`, valid for 30 minutes) that links it after the user signs in and confirms; the bot then messages the number to say it's signed in (the full number travels in the token encrypted, never readable in the URL). A linked number then works like the web agent: the same MCP servers, and its tool calls are metered against that user's plan. Before each answer the bot checks the user's rx-subscription allowance. When it's used up, the bot sends a sign-in link to `/billing` instead. Users see and unlink their numbers under API keys → WhatsApp. Numbers are stored only as a hash plus their last four digits. Conversations are saved as chats in the user's history, with the last 20 messages sent to the model. `/new` starts over, and `/signout` (or `/logout`) unlinks the number and sends a fresh sign-in link. People can also just ask ("log me out", "unlink my account", "登出"): the agent has a `sign_out` tool, always loaded rather than behind `search_tools`, and the bot unlinks the number once the reply is sent. Only text is read; group messages are ignored.

When the agent calls a tool that has an MCP App, the bot also sends a picture of the result (a chat card) before its text answer, since WhatsApp can't run the app. Images go out through Wasender's `/upload` (kept for 24 hours) and `imageUrl`.

## Telegram

People can also chat with the agent on Telegram.

1. Create a bot with [@BotFather](https://t.me/BotFather). Set `TELEGRAM_BOT_TOKEN` to its token and `TELEGRAM_WEBHOOK_SECRET` to a random string (letters, digits, `_` and `-`). Optionally set `TELEGRAM_BOT_USERNAME` for "Chat on Telegram" links.
2. Run `bun run telegram:webhook https://<site>` (defaults to `NEXT_PUBLIC_SITE_URL`). It calls `setWebhook` for `https://<site>/api/telegram` with the secret and the `message` update only, and adds `/new` and `/signout` to the bot's menu. Telegram only calls public https URLs, so for local work pass a tunnel URL such as one from `cloudflared tunnel --url http://localhost:3000`.

Every webhook must carry the secret in `X-Telegram-Bot-Api-Secret-Token`. Linking, billing and history work as for WhatsApp: unlinked accounts get a sign-in button to `/telegram/link?token=…` (signed with `AUTH_SECRET`, valid for 30 minutes), linked accounts are answered by the user's agent and metered against their plan, and a used-up allowance gets a link to `/billing`. Once linked, the bot confirms in the chat (the chat id travels in the token encrypted). Users see and unlink their accounts under API keys → Telegram, or send `/signout` (or `/logout`) in the chat, or ask in their own words as on WhatsApp. Telegram user ids are stored only as a hash, with the @username or first name for display. Replies are sent as Telegram HTML, falling back to plain text if Telegram can't parse them, and "typing…" shows while the agent works. `/new` starts over; `/start` greets. Only text in private chats is read. Tools with an MCP App get a chat card, sent as a photo before the answer, as on WhatsApp.

### Chat cards

Each service with an app also has `mcp/services/<id>/card.ts`, which turns a tool result into a `Card` (header, rows, chips, notices; see `mcp/apps/card.ts`) mirroring its `app.ts`, and is registered in `lib/cards/index.ts`. `lib/cards/render.ts` lays the card out with [satori](https://github.com/vercel/satori) into an SVG and rasterises it to a 1080px-wide PNG with sharp. Text is drawn in Noto Sans HK, fetched from Google Fonts subset to the characters on the card, so English and Chinese both render without system fonts. A reply sends at most three cards (the latest result per tool and input); long lists stop at ten rows. A card that fails to render is skipped and the text answer still goes out.

## Tracker

`converted` comes from `generated/manifest.json`. Planned / in progress / skipped (with a reason) and priority are set by admins (RxLab role `admin`) in the dataset dialog. `package_search` only indexes ~785 datasets, so the sync walks `package_list` and calls `package_show` for new ids first, then the least recently synced.
