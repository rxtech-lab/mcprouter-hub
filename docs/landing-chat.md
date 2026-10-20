# Landing chat

`POST /api/free-chat` accepts `{ messages: UIMessage[] }` and returns an AI SDK UI message stream. The landing conversation stays in browser storage.

The server derives identity from the session. Signed-in requests use the member's identity with the web MCP channel and normal tool-call billing; they do not consume guest message quota or set a guest cookie. Signed-out requests use the existing visitor cookie and daily visitor/address limits. Only guest responses include `x-free-chat-remaining`; exhausted guests receive 429. Disabling free chat rejects guest requests with 404.

The landing chat uses `getChatAllowance` for session-aware usage, refreshing after replies and on window focus. Members see plan allowance and credits; guests see their daily message quota and sign-in link. No guest allowance is assumed while usage loads.
