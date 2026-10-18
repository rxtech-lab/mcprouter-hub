/** Setup guides for the MCP clients mcprouter supports, shared by the setup page and the new-key dialog. */

export type SetupStep = { text: string; code?: string };

export type McpClient = {
  id: string;
  name: string;
  /** Where the client runs, shown under its name. */
  kind: string;
  /** Sign in with OAuth: no key to copy, access is managed under Connected apps. */
  oauth: (endpoint: string) => SetupStep[];
  /** Paste an API key instead. Absent for clients that only connect through OAuth. */
  apiKey?: (endpoint: string, key: string) => SetupStep[];
  note?: string;
};

export const SERVER_NAME = "mcprouter";
export const KEY_PLACEHOLDER = "mcpr_your_key";

export const MCP_CLIENTS: McpClient[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    kind: "Terminal",
    oauth: (endpoint) => [
      { text: "Add mcprouter as a remote HTTP server.", code: `claude mcp add --transport http ${SERVER_NAME} ${endpoint}` },
      { text: "Start Claude Code, run /mcp, choose mcprouter and pick Authenticate. Sign in and approve access in the browser that opens.", code: "/mcp" },
    ],
    apiKey: (endpoint, key) => [
      {
        text: "Add the server with your key in the Authorization header.",
        code: `claude mcp add --transport http ${SERVER_NAME} ${endpoint} \\\n  --header "Authorization: Bearer ${key}"`,
      },
      { text: "Run /mcp in Claude Code to check that mcprouter is connected." },
    ],
    note: "Add --scope user to use mcprouter in every project, or --scope project to share it through .mcp.json.",
  },
  {
    id: "claude",
    name: "Claude",
    kind: "claude.ai, Desktop and mobile",
    oauth: (endpoint) => [
      { text: "In Claude, open Settings → Connectors and choose Add custom connector." },
      { text: "Name it mcprouter and paste the server URL.", code: endpoint },
      { text: "Choose Add, then Connect. Sign in to mcprouter and approve access." },
      { text: "In a chat, open the tools menu and turn on mcprouter. Connectors added on the web also appear in Claude Desktop and the mobile apps." },
    ],
    note: "On Team and Enterprise plans, an owner adds the connector under Admin settings → Connectors first. Each member then connects it themselves.",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    kind: "chatgpt.com",
    oauth: (endpoint) => [
      { text: "In ChatGPT, open Settings → Apps & Connectors → Advanced settings and turn on Developer mode." },
      { text: "Back in Apps & Connectors, choose Create. Name it mcprouter and paste the MCP server URL.", code: endpoint },
      { text: "Set Authentication to OAuth, confirm that you trust the app, then choose Create. Sign in to mcprouter and approve access." },
      { text: "In a chat, choose Developer mode from the + menu and turn on mcprouter." },
    ],
    note: "Developer mode is available on Plus, Pro, Business, Enterprise and Edu plans. On workspace plans an admin may need to allow it.",
  },
  {
    id: "codex",
    name: "Codex",
    kind: "CLI and IDE extension",
    oauth: (endpoint) => [
      { text: "Add mcprouter as a streamable HTTP server.", code: `codex mcp add ${SERVER_NAME} --url ${endpoint}` },
      { text: "Sign in. Codex opens your browser to approve access.", code: `codex mcp login ${SERVER_NAME}` },
      { text: "Run /mcp in Codex to check that mcprouter's tools are listed." },
    ],
    apiKey: (endpoint, key) => [
      { text: "Export your key. Add it to your shell profile so new terminals have it too.", code: `export MCPROUTER_API_KEY="${key}"` },
      {
        text: "Add the server to ~/.codex/config.toml. Codex sends the variable as a Bearer token.",
        code: `[mcp_servers.${SERVER_NAME}]\nurl = "${endpoint}"\nbearer_token_env_var = "MCPROUTER_API_KEY"`,
      },
      { text: "Run /mcp in Codex to check that mcprouter's tools are listed." },
    ],
    note: "The CLI and the Codex IDE extension share ~/.codex/config.toml, so one setup covers both.",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    kind: "Terminal",
    oauth: (endpoint) => [
      { text: "Add mcprouter as an HTTP server.", code: `gemini mcp add --transport http ${SERVER_NAME} ${endpoint}` },
      { text: "Start Gemini CLI and sign in. Your browser opens to approve access.", code: `/mcp auth ${SERVER_NAME}` },
      { text: "Run /mcp to check that mcprouter's tools are listed." },
    ],
    apiKey: (endpoint, key) => [
      {
        text: "Add the server with your key in the Authorization header.",
        code: `gemini mcp add --transport http ${SERVER_NAME} ${endpoint} \\\n  --header "Authorization: Bearer ${key}"`,
      },
      {
        text: "Or add it to ~/.gemini/settings.json yourself.",
        code: JSON.stringify({ mcpServers: { [SERVER_NAME]: { httpUrl: endpoint, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
      },
    ],
    note: "Add --scope user to use mcprouter in every folder. Without it the server is saved to the project's .gemini/settings.json.",
  },
  {
    id: "cursor",
    name: "Cursor",
    kind: "Editor",
    oauth: (endpoint) => [
      { text: "Add mcprouter to ~/.cursor/mcp.json.", code: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: endpoint } } }, null, 2) },
      { text: "Open Cursor Settings → MCP, find mcprouter and choose Connect. Sign in and approve access." },
    ],
    apiKey: (endpoint, key) => [
      {
        text: "Add mcprouter to ~/.cursor/mcp.json with your key.",
        code: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: endpoint, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
      },
    ],
  },
  {
    id: "other",
    name: "Other clients",
    kind: "Any MCP client",
    oauth: (endpoint) => [
      { text: "Point the client at the Streamable HTTP endpoint. Clients that support MCP authorization find sign-in on their own.", code: endpoint },
    ],
    apiKey: (endpoint, key) => [
      {
        text: "Send the key as a Bearer token. Clients that only speak stdio can go through mcp-remote.",
        code: JSON.stringify(
          { mcpServers: { [SERVER_NAME]: { command: "npx", args: ["-y", "mcp-remote", endpoint, "--header", `Authorization:Bearer ${key}`] } } },
          null,
          2,
        ),
      },
    ],
  },
];

export function mcpClientById(id: string | undefined) {
  return MCP_CLIENTS.find((client) => client.id === id);
}

/** Clients that take a pasted key, offered right after a key is created. */
export const KEY_CLIENTS = MCP_CLIENTS.filter((client): client is McpClient & Required<Pick<McpClient, "apiKey">> => Boolean(client.apiKey));
