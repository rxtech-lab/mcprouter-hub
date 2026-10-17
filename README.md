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

Create a key at `/keys`, then point any MCP client at `http://localhost:3000/api/mcp/mcp` with `Authorization: Bearer mcpr_…`.
To inspect it: `bunx @modelcontextprotocol/inspector` with that URL and header.

## Endpoints

| Path | What |
|---|---|
| `/api/mcp/mcp` | Every service (Streamable HTTP, stateless) |
| `/api/mcp/s/<service>/mcp` | One service, for a smaller tool list |
| `/api/chat` | The agent (AI SDK 7), used by `/chat` |
| `/api/cron/sync-catalog` | Daily catalogue sync (Vercel cron, `CRON_SECRET`) |

Keys arrive as a Bearer header or `?token=`. They're stored as a sha256 hash, can be limited to services, and every call is metered against rx-subscription when `BILLING_ENABLED=true`. With `RX_SUBSCRIPTION_CREDIT_UNIT` set, each call (including the dashboard agent's) first takes 1 from that balance (`POST /api/v1/balances`, refused when empty) and is then tracked on the usage item `RX_SUBSCRIPTION_USAGE_ITEM` (`POST /api/v1/usage`); without it, the usage item's plan allowance is the gate. rx-subscription keeps the usage log; the Usage pages read it back from `/api/v1/usage/statistics` and `/api/v1/balances/ledger`.

## Adding an MCP service

1. Create `mcp/services/<id>/service.yaml` (schema: `mcp/schema.ts`; `mcp/services/kmb/service.yaml` is a good template).
2. For anything YAML can't express, set `handler: name` on the tool and export `name` from `mcp/services/<id>/handlers.ts`.
3. Run `bun run codegen` (also runs on `bun install`, `dev` and `build`). `generated/` is gitignored.

List the service's CKAN dataset ids under `datasets:`; the tracker counts them as converted.

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
```

## Scripts

| Script | |
|---|---|
| `bun run codegen [--check]` | YAML → `generated/` |
| `bun run theme` | Regenerate `app/m3-tokens.css` from the seed colour |
| `bun run catalog:sync [--limit N]` | Sync the CKAN catalogue without the cron's time budget |
| `bun run tracker:report [--markdown]` | Tracker summary in the terminal |
| `bun run test` / `bun run test:e2e` | vitest / Playwright (`DEV_BYPASS_AUTH`) |

## Agent

`AGENT_MCP_SERVERS` is a JSON list of `{ name, url, headers }`. `url: "self"` is this app's `/api/mcp/mcp`, called with `MCPROUTER_INTERNAL_KEY` on behalf of the signed-in user, so the agent's tool calls are billed to them. Tools from other servers are prefixed `<name>__`. `AI_MODEL` is an AI Gateway model string. The agent loads tools on demand: it starts with only `search_tools`, which ranks tools by embedding similarity (`AI_EMBEDDING_MODEL`, default `openai/text-embedding-3-small`) merged with keyword matches, and falls back to keywords if embedding fails.

## Tracker

`converted` comes from `generated/manifest.json`. Planned / in progress / skipped (with a reason) and priority are set by admins (RxLab role `admin`) in the dataset dialog. `package_search` only indexes ~785 datasets, so the sync walks `package_list` and calls `package_show` for new ids first, then the least recently synced.
