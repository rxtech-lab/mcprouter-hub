# API catalogue chat

Opening `/sources/apis?api=API-0014` renders a centered native dialog with API details and the available MCP tools on the left and a scoped chat on the right. Drag the divider, or focus it and use the arrow keys, Home, or End. On small screens, Details & tools and Chat switch between the two views.

Full screen expands the dialog and adds `fullscreen=1` to the URL; Minimize returns to the centered dialog. Clicking a tool name immediately sends `Use this tool: <tool name>` to the scoped agent and switches to chat on mobile. `panel=details` selects the details view on mobile. View updates preserve the mounted chat, including an active response and a draft. Closing the dialog clears its conversation and returns to the original catalogue filters. Conversations are ephemeral and are not added to dashboard chat history. APIs without implemented tools show their details without a composer.

The Chat button on `/sources/[service]` opens the same dialog inline at `?chat=1`, without navigating to the landing page. It includes that service’s tool shortcuts, usage/credit footer and display tools, with fullscreen, resizing and minimize controls. Closing returns to the service page.

## POST /api/provider-chat

Accepts `{ "apiId": "API-0014", "messages": [...] }` or `{ "serviceId": "td-street-parking", "messages": [...] }` using AI SDK UI messages. Exactly one source selector is required; unknown services and ambiguous selections are rejected. Service chats are scoped to that single service rather than all services associated with an API. Returns the AI SDK UI message SSE stream. The server resolves the API's implemented services and tool names from the generated catalogue. Browser-supplied service scopes or tool names are ignored. Only this app's internal MCP server is connected, with those service scopes and `all` tool mode. A second tool-name allowlist restricts the model and loads the tools immediately. External agent servers, global tool search, dashboard tools and account tools are excluded.

Both `show_ui` and `show_tool_ui` are loaded for visual results. `show_tool_ui` accepts only visual apps belonging to the selected API tools. These presentation helpers do not expose additional data providers.

The API dialog and main chat page show a personal allowance footer, loaded separately from the public catalogue: guests see the shared daily free-message quota and a sign-in link for credits; members see their plan allowance and available balances for the configured billing credit unit. Missing billing data displays as unavailable, not as zero. Values refresh after replies and when the window regains focus.

Signed-in calls run under the member's identity and normal MCP metering. Guests share the existing free-chat cookie and daily visitor/address allowance; successful guest streams include `x-free-chat-remaining`. The free-chat feature flag also applies to guests here.

Validation happens before quota consumption: unknown/unimplemented APIs or invalid messages return 400; bodies over 200,000 characters or questions over 2,000 characters return 413. History is limited to the last 20 messages. Disabled guest access returns 403, exhausted allowance returns 429, and unavailable MCP credentials or connection setup returns 503. Errors are plain text and appear as an overlay inside the dialog.

Verification: `tests/provider-chat.test.ts` covers input validation, server-derived scopes, member identity, guest quotas and unavailable credentials without invoking a model. `e2e/api-workspace.spec.ts` checks desktop resizing, mobile navigation, minimize/restore, unavailable APIs and dark-mode message-row background consistency. Its answer stream is a browser fixture, so these checks do not establish live model or provider availability.

## Formatted replies and questions

Web replies support Markdown paragraphs, headings, emphasis, lists, code and scrollable tables. The web agent is instructed to use that formatting for readable answers.

The web-only `request_user_input` tool accepts `{ question: string, options: { label: string, description?: string }[] }` (up to six choices; an empty array means free text). Options must come from conversation context or real tool results. It returns `{ awaitingUserInput: true }` and stops the current generation. A question card opens a native answer dialog with radio choices and an editable custom answer. Submitting sends a normal user message through the existing chat endpoint and allowance flow; it does not invoke provider tools directly. Previous questions and questions shown during generation cannot be submitted. Bot channels continue to ask in text.

## Location permission in web chat

The web-only `request_user_location` tool accepts `{ reason: string }` and returns `{ awaitingUserLocation: true }`. It is always available in dashboard, landing and provider-scoped chats and stops generation until the next user message. The agent should request it for nearby/current-location questions when the conversation has no suitable location, and use a named place directly when one was supplied. Bot channels do not expose this browser tool.

The request card opens a native dialog explaining that sharing sends coordinates and accuracy to the chat and answering tools. Only **Share location** calls browser geolocation, even if browser permission was previously granted. A single fresh fix is requested with a ten-second timeout; there is no continuous tracking. Success sends a normal user message containing latitude/longitude rounded to five decimals, accuracy in metres and capture time through the existing endpoint and quota flow. Dashboard conversations retain this message under their normal history policy; catalogue conversations remain ephemeral. Landing chat retains messages in browser localStorage under its existing conversation-history policy. Coordinates are not put in URL parameters.

Closing the dialog shares nothing. **Enter a place instead** sends a refusal and asks the agent for a manually supplied place. Permission denial, unavailable browsers and location errors appear in the dialog without sending coordinates, with retry and manual entry available. The pending operation has a status overlay; late callbacks after dialog cancellation, a newer turn or unmount cannot submit a location. Historical request cards are disabled.

`tests/location.test.ts` verifies the consent acknowledgement and minimal location payload. `e2e/chat-location.spec.ts` covers desktop/mobile sharing, explicit consent, declining, denial, timeout, unsupported browsers and stale callbacks with fixture agent streams and simulated browser locations. These checks do not establish live model tool selection or physical device positioning accuracy.
