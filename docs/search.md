# Command search and chat

The public header opens a native modal command menu. `search` and `searchView`
URL parameters retain the keyword and view; unrelated URL parameters are preserved.
After one second without typing, the server text-matches navigation, services and
APIs and asks an AI SDK Decision model whether the query should instead be answered.
Text search (GET) and AI routing (POST) start in parallel. Text matches appear as
soon as they arrive, while routing continues; either response can arrive first.
An unavailable routing request preserves the text matches, and changing the query
or closing the dialog cancels both requests.
Enter or the submit arrow searches immediately. Selecting a result navigates normally.

The model uses AI SDK 7's `experimental_decide` with a `choice` question whose
only permitted answers are `search` and `chat`. `SEARCH_DECISION_MODEL` defaults to
`typesafe-ai/jev`; it requires the existing server-side `AI_GATEWAY_API_KEY` or
Vercel OIDC credentials. This model is independent of `AI_MODEL`/`FREE_CHAT_MODEL`.
Decision requests have an eight-second timeout and no automatic retries. Errors,
invalid decisions, disabled guest chat, or routing limits return text results with
`fallback: true`. The UI explains that automatic routing is unavailable.

A Chat button in the search footer opens or resumes the saved conversation without
sending the search text or waiting for a model decision.

A `chat` decision adds a highlighted “Chat with the agent about this” command
above the text matches. It does not start a conversation or consume chat allowance.
Pressing Enter or selecting that command changes the same modal into a conversation,
with a Back to search button. Conversation text is saved in this browser’s local storage under
`site-search-chat-messages` and restored when chat reopens or the page reloads.
It is removed from the URL on transition. New chat clears the saved history.
Invalid saved messages are ignored, and blocked/full storage does not prevent chatting. Follow-ups go directly to the existing
`/api/free-chat` streaming endpoint and use its guest allowance, authenticated
identity, tool metering and MCP tool rendering. Closing/back stops the browser stream.

## HTTP contract

- `GET /api/search?q=<text>&locale=en|zh-HK|zh-CN`: deterministic text search, no
  model or quota consumption. Empty queries return navigation. Maximum 2000 characters.
- `POST /api/search`, JSON `{ "query": "...", "locale": "en" }`: nonempty query,
  maximum 2000 characters; response `{ "intent": "search" | "chat", "results":
  [{ "href": "...", "label": "...", "key": "...", "description": "..." }],
  "fallback"?: true }`. Results are capped at 12. Invalid input returns 400 and
  oversized request bodies return 413. Responses use `private, no-store`.
- Decision calls use a separate database counter namespace, capped at 60 per
  session/member and 240 per network address per Hong Kong day. They never consume
  the visitor's chat messages. Raw IPs are hashed through the existing quota helper.

## Verification

Run `bun run test tests/site-search.test.ts tests/site-search-route.test.ts tests/site-search-request.test.ts`.
`e2e/site-search.spec.ts` checks desktop/mobile search, one-second debounce,
automatic routing, multi-turn chat, Back to search and model failure. Browser AI
responses are synthetic; regular text results come from the real server. A delayed
decision check verifies that text matches appear before routing completes.

For HTTP verification of the actual AI SDK classifier, start:

```sh
postman simulation run postman/simulations/search-decision.sim.yaml --port 4918 --output ndjson
```

Then run:

```sh
bun --conditions=react-server scripts/verify-search-decision-simulation.ts
```

The local mock follows the installed GatewayDecisionModel wire contract. Its
fixed choices test transport and validation rather than live semantic accuracy.
The provider-owned mock lookup was skipped because the local CLI is signed out.
No shared Postman workspace is changed.
