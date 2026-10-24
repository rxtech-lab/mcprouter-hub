# RxSubscription usage metering

With `BILLING_ENABLED=true`, RxSubscription's `POST /api/v1/usage` is the single
authority for plan allowances, reset windows and balance-backed overage. The app
does not debit a stored balance separately. Existing balances and ledgers stay in
RxSubscription; this change does not convert purchased credits into usage counts.

| Action | Usage key | Amount |
| --- | --- | --- |
| Signed-in chat message (web, Telegram, WhatsApp) | `chat` | 1 |
| Direct ordinary MCP tool call (API key or OAuth) | `mcp_calls` | 1 |
| Any `unified-news` tool, including during a metered chat | `premium_mcp` | 1 |
| Ordinary tools during an already metered chat | Included in `chat` | 0 extra |

All four news tools are premium: `list_top_news`, `get_news_detail`, `search_news`
and `scrape_website`. Reusing saved article content still constitutes one premium
tool invocation. A detail fallback scrape happens inside that invocation and does
not create a second premium event. Free-agent guests cannot execute premium news
tools while billing is enabled. External MCP servers retain their own billing.

Usage is checked before executing the tool or agent. Explicit denial and billing
outages stop execution. Chat message idempotency keys remain stable across retries;
duplicates cannot start another agent run. Each new MCP invocation gets a new event
key. Calls that fail after admission consume their admitted usage, as before.
There are no automatic billing write retries.

The chat footer and Billing page show the live `used / limit` values, with `null`
limits rendered as unlimited and missing usage rendered as unavailable. Stored
credits remain at `/usage/credits`. Standard and premium statistics use separate
URL-backed views (`/usage?meter=standard` and `/usage?meter=premium`); overall
dashboard totals combine both meters. Provider/tool breakdowns use the local call
log and include denied attempts; consumption statistics come from RxSubscription.

## Live configuration checked on 2026-10-25

The configured application is **HKMcpTools** (`client_d73e5130c9e84148af53488246c727dd`),
not the separate empty `mcprouter` application. The local API credential selects
the sandbox environment; usage-item definitions are shared application settings.

The console and its workspace agent were used to create and verify `premium_mcp`
(usage item `be37ca79-1cf7-458e-acca-9bef786f15be`) and the dedicated premium points
unit (`premium_mcp`, `15daef61-8921-48ac-8016-59a18df58715`). The final saved plan
allowances are:

| Plan | `mcp_calls` | `chat` | `premium_mcp` |
| --- | ---: | ---: | ---: |
| Plus | 200,000 | 10,000 | 1,000 |
| Pay as you go | 0 | 0 | 0 |

The original conflicting unlimited/duplicate usage entitlements were removed by
exact ID, leaving one entitlement per meter per plan. Usage items retain their
existing daily calendar reset. These are per-day limits; a monthly reset was not
configured because it would also change the Free plan's shared usage windows.
Free plan allowances and existing recurring balance grants were preserved.

All three meters use `charge_balance` overage at one matching point per call:
`chat` uses `chat`, `mcp_calls` uses `mcp-calls`, and `premium_mcp` uses
`premium_mcp`. Zero included usage therefore spends matching points from the first
call. An exhausted finite allowance also falls back to those matching points.
The usage API still records consumption for statistics; the app never makes an
additional debit. A null limit remains an unlimited allowance, not a zero limit.

The console agent's update tool cannot set `overageUnitId`, so the Chat and
premium point mappings were saved through the full usage-item dialog, then
independently read back by the agent. Existing purchased balances, user counters,
ledger history, prices and subscription records were preserved.

The existing active $4.99 top-up (`mcp-calls-10000`,
`e9764e1a-6432-446e-8210-601740e3aa7a`) now grants 10,000 `mcp-calls` points,
500 `chat` points and 50 `premium_mcp` points. Its price and Pay as you go OR Plus
eligibility remain unchanged. The premium quantity follows the plan's 200:10:1
MCP/chat/premium ratio. The console agent read back the saved grants after writing.

## Verification

`postman/simulations/chat-billing.context.md` contains the reproducible HTTP
simulation. It exercises the actual client and meter without charging live users.
Unit tests cover premium routing for every news tool, included ordinary chat tools,
guest refusal, quota errors, outage handling and UI allowance data.

On 2026-10-25, all 96 unit-test files passed (4,475 tests passed; 46 integration
tests skipped without their optional simulations). The real-client billing HTTP
simulation passed independent matching-point pools and zero-limit Pay as you go.
Four browser tests cover desktop/mobile chat, usage limits, stored-credit history,
top-up grant display and URL-backed meter navigation. UI checks run from an
isolated source copy so the existing development server is preserved.

The live meter exists, but the app code requires deployment before traffic uses
the new billing path. No historical counters were reset or replayed.
