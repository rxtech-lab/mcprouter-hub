---
name: mcprouter
description: Use a connected mcprouter MCP server to find and query open data, including Hong Kong weather, transport, healthcare and public datasets, and present its MCP App results without duplicate UI.
---

# mcprouter

Use the connected server's tools for current data. Do not infer availability from a remembered service list: account settings and endpoint scopes can limit discovery.

## Find and call tools

- When the server exposes `search_tools`, search for the user's question, then call `read_tool` for the selected tool's current arguments and schema. Execute it through `use_tool` with its name and `arguments`.
- When tools are exposed directly, use their current descriptions and input schemas. Preserve any client-assigned server prefix when calling them.
- Ask for missing required inputs instead of guessing identifiers or coordinates. Use the tool's supported language values; where offered, `tc` means Traditional Chinese, `sc` Simplified Chinese and `en` English. Reply in the user's language.
- Treat Hong Kong local times as UTC+8 unless the source states otherwise. Preserve source timestamps and distinguish an empty result from a failed or unavailable source. Never invent live values after an error.

## Present results once

Tools can advertise an MCP App through `_meta.ui.resourceUri` (or legacy `_meta["ui/resourceUri"]`). A compatible host renders that app from the returned result. Use the existing app as the result display; do not recreate the same information in another generated UI, card, table or chart. Add a short answer or interpretation when helpful.

In mcprouter's own web agent and messaging channels, provider calls are folded until selected for display: use `show_tool_ui` once for a result with a visual app. Do not also call `show_ui` for that same result. Map and route tools that display themselves need no second display call. These display tools belong to mcprouter's built-in agent; do not assume they exist in an external MCP client.

If the host cannot render MCP Apps, or the selected tool has no app, give a concise text summary from the returned content. Use a custom visualization only when it adds something the existing app does not show or the user explicitly requests another format. Do not dump raw JSON or treat an HTTP success with empty/error content as useful data.

## Connect when needed

If no mcprouter tools are connected, use the user's deployment origin and `/api/mcp/streamable`. The combined endpoint normally exposes the three discovery/execution tools above; `?tools=all` lists tools directly, and `/api/mcp/s/<service>/streamable` scopes the connection to one service. Follow the client's OAuth flow or use an API key stored in its secret configuration. Never put credentials into this skill or ask the user to paste them into conversation. Connection setup guides are available under `/keys/apps` on that deployment.
