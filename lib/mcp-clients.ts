/**
 * Setup guides for the MCP clients mcprouter supports, shared by the setup page and the new-key dialog.
 * Step text, link labels, `kind`, `note` and the "Other clients" name are English msgids: render them with `t(...)`.
 */
import { msg } from "@/lib/i18n/translate";

/** `link` opens a page in the client (e.g. its settings) in a new tab. */
export type SetupStep = { text: string; code?: string; link?: { href: string; label: string } };

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
    kind: msg("Terminal"),
    oauth: (endpoint) => [
      { text: msg("Add mcprouter as a remote HTTP server."), code: `claude mcp add --transport http ${SERVER_NAME} ${endpoint}` },
      { text: msg("Start Claude Code, run /mcp, choose mcprouter and pick Authenticate. Sign in and approve access in the browser that opens."), code: "/mcp" },
    ],
    apiKey: (endpoint, key) => [
      {
        text: msg("Add the server with your key in the Authorization header."),
        code: `claude mcp add --transport http ${SERVER_NAME} ${endpoint} \\\n  --header "Authorization: Bearer ${key}"`,
      },
      { text: msg("Run /mcp in Claude Code to check that mcprouter is connected.") },
    ],
    note: msg("Add --scope user to use mcprouter in every project, or --scope project to share it through .mcp.json."),
  },
  {
    id: "claude",
    name: "Claude",
    kind: msg("claude.ai, Desktop and mobile"),
    oauth: (endpoint) => [
      { text: msg("In Claude, open Settings → Connectors and choose Add custom connector.") },
      { text: msg("Name it mcprouter and paste the server URL."), code: endpoint },
      { text: msg("Choose Add, then Connect. Sign in to mcprouter and approve access.") },
      { text: msg("In a chat, open the tools menu and turn on mcprouter. Connectors added on the web also appear in Claude Desktop and the mobile apps.") },
    ],
    note: msg("On Team and Enterprise plans, an owner adds the connector under Admin settings → Connectors first. Each member then connects it themselves."),
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    kind: "chatgpt.com",
    oauth: (endpoint) => [
      { text: msg("In ChatGPT, open Settings → Security and login and turn on Developer mode.") },
      {
        text: msg("On the Plugins page, choose Add → Create MCP App. Name it mcprouter, keep Server URL selected under Connection and paste the MCP server URL."),
        code: endpoint,
        link: { href: "https://chatgpt.com/plugins", label: msg("Open ChatGPT Plugins") },
      },
      { text: msg("Leave Authentication on OAuth, tick the acknowledgement, then choose Create. Sign in to mcprouter and approve access.") },
      { text: msg("In a chat, type @ or open the tools menu and pick mcprouter.") },
    ],
    note: msg("Developer mode is available on Plus and Pro, and on Business, Enterprise and Edu plans where an admin allows it."),
  },
  {
    id: "gemini-web",
    name: "Gemini",
    kind: "gemini.google.com",
    oauth: (endpoint) => [
      {
        text: msg("In Gemini on the web, open Settings → Connected Apps. Under Custom apps, choose Add a custom app and paste the MCP server URL."),
        code: endpoint,
        link: { href: "https://gemini.google.com/customize/connectors", label: msg("Open Gemini Connected Apps") },
      },
      { text: msg("Choose Next. Leave Advanced features closed, as mcprouter registers itself. Sign in to mcprouter and approve access.") },
      { text: msg("In a chat, type @ and pick mcprouter. Once added on the web, it also works in the Gemini mobile app.") },
    ],
    note: msg("Custom apps need a personal Google Account (not work or school), Keep Activity turned on, and are available in English to people 18 or over in the US."),
  },
  {
    id: "codex",
    name: "Codex",
    kind: msg("CLI and IDE extension"),
    oauth: (endpoint) => [
      { text: msg("Add mcprouter as a streamable HTTP server."), code: `codex mcp add ${SERVER_NAME} --url ${endpoint}` },
      { text: msg("Sign in. Codex opens your browser to approve access."), code: `codex mcp login ${SERVER_NAME}` },
      { text: msg("Run /mcp in Codex to check that mcprouter's tools are listed.") },
    ],
    apiKey: (endpoint, key) => [
      { text: msg("Export your key. Add it to your shell profile so new terminals have it too."), code: `export MCPROUTER_API_KEY="${key}"` },
      {
        text: msg("Add the server to ~/.codex/config.toml. Codex sends the variable as a Bearer token."),
        code: `[mcp_servers.${SERVER_NAME}]\nurl = "${endpoint}"\nbearer_token_env_var = "MCPROUTER_API_KEY"`,
      },
      { text: msg("Run /mcp in Codex to check that mcprouter's tools are listed.") },
    ],
    note: msg("The CLI and the Codex IDE extension share ~/.codex/config.toml, so one setup covers both."),
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    kind: msg("Terminal"),
    oauth: (endpoint) => [
      { text: msg("Add mcprouter as an HTTP server."), code: `gemini mcp add --transport http ${SERVER_NAME} ${endpoint}` },
      { text: msg("Start Gemini CLI and sign in. Your browser opens to approve access."), code: `/mcp auth ${SERVER_NAME}` },
      { text: msg("Run /mcp to check that mcprouter's tools are listed.") },
    ],
    apiKey: (endpoint, key) => [
      {
        text: msg("Add the server with your key in the Authorization header."),
        code: `gemini mcp add --transport http ${SERVER_NAME} ${endpoint} \\\n  --header "Authorization: Bearer ${key}"`,
      },
      {
        text: msg("Or add it to ~/.gemini/settings.json yourself."),
        code: JSON.stringify({ mcpServers: { [SERVER_NAME]: { httpUrl: endpoint, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
      },
    ],
    note: msg("Add --scope user to use mcprouter in every folder. Without it the server is saved to the project's .gemini/settings.json."),
  },
  {
    id: "cursor",
    name: "Cursor",
    kind: msg("Editor"),
    oauth: (endpoint) => [
      { text: msg("Add mcprouter to ~/.cursor/mcp.json."), code: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: endpoint } } }, null, 2) },
      { text: msg("Open Cursor Settings → MCP, find mcprouter and choose Connect. Sign in and approve access.") },
    ],
    apiKey: (endpoint, key) => [
      {
        text: msg("Add mcprouter to ~/.cursor/mcp.json with your key."),
        code: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: endpoint, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
      },
    ],
  },
  {
    id: "other",
    name: msg("Other clients"),
    kind: msg("Any MCP client"),
    oauth: (endpoint) => [
      { text: msg("Point the client at the Streamable HTTP endpoint. Clients that support MCP authorization find sign-in on their own."), code: endpoint },
    ],
    apiKey: (endpoint, key) => [
      {
        text: msg("Send the key as a Bearer token. Clients that only speak stdio can go through mcp-remote."),
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
