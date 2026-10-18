import crypto from "node:crypto";
import { expect, test } from "@playwright/test";

const callback = "http://127.0.0.1:43117/callback";
const rpc = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
const mcpHeaders = { Accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" };

test("an OAuth client discovers sign-in, gets approved and calls the MCP endpoint", async ({ page, baseURL }) => {
  // 1. An unauthenticated call points at this endpoint's resource metadata.
  const challenge = await page.request.post("/api/mcp/s/kmb/mcp", { headers: mcpHeaders, data: rpc });
  expect(challenge.status()).toBe(401);
  const wwwAuthenticate = challenge.headers()["www-authenticate"];
  const metadataUrl = /resource_metadata="([^"]+)"/.exec(wwwAuthenticate)?.[1];
  expect(metadataUrl).toBe(`${baseURL}/.well-known/oauth-protected-resource/api/mcp/s/kmb/mcp`);

  const resourceMetadata = await (await page.request.get(metadataUrl!)).json();
  expect(resourceMetadata.resource).toBe(`${baseURL}/api/mcp/s/kmb/mcp`);
  const server = await (await page.request.get(`${resourceMetadata.authorization_servers[0]}/.well-known/oauth-authorization-server`)).json();
  expect(server.code_challenge_methods_supported).toEqual(["S256"]);

  // 2. Dynamic client registration.
  const registered = await page.request.post(server.registration_endpoint, { data: { client_name: "E2E agent", redirect_uris: [callback] } });
  expect(registered.status()).toBe(201);
  const { client_id } = await registered.json();

  // 3. The user approves on the consent page; the browser comes back to the client's callback.
  const verifier = crypto.randomBytes(32).toString("base64url");
  const authorizeUrl = new URL(server.authorization_endpoint);
  for (const [name, value] of Object.entries({
    response_type: "code",
    client_id,
    redirect_uri: callback,
    code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    state: "e2e-state",
    resource: resourceMetadata.resource,
    scope: "mcp",
  })) authorizeUrl.searchParams.set(name, value);

  let returned: URL | null = null;
  await page.route(`${callback}**`, (route) => {
    returned = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/html", body: "<p>done</p>" });
  });
  await page.goto(authorizeUrl.href);
  await expect(page.getByRole("heading", { name: /Allow E2E agent to use mcprouter/ })).toBeVisible();
  await expect(page.getByText("the Buses & Minibuses tools", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Allow" }).click();
  await expect.poll(() => returned?.searchParams.get("code") ?? null).not.toBeNull();
  expect(returned!.searchParams.get("state")).toBe("e2e-state");
  expect(returned!.searchParams.get("iss")).toBe(baseURL);

  // 4. Code exchange, then the token works on its endpoint only.
  const tokenResponse = await page.request.post(server.token_endpoint, {
    form: { grant_type: "authorization_code", code: returned!.searchParams.get("code")!, client_id, redirect_uri: callback, code_verifier: verifier, resource: resourceMetadata.resource },
  });
  expect(tokenResponse.status()).toBe(200);
  const tokens = await tokenResponse.json();

  const list = await page.request.post("/api/mcp/s/kmb/mcp", { headers: { ...mcpHeaders, Authorization: `Bearer ${tokens.access_token}` }, data: rpc });
  expect(list.status()).toBe(200);
  expect(await list.text()).toContain("kmb_stop_eta");
  const elsewhere = await page.request.post("/api/mcp/mcp", { headers: { ...mcpHeaders, Authorization: `Bearer ${tokens.access_token}` }, data: rpc });
  expect(elsewhere.status()).toBe(401);

  // 5. The app shows up under Connected apps and can be disconnected.
  await page.goto("/keys/apps");
  const card = page.getByTestId("app-card").filter({ hasText: "E2E agent" }).first();
  await expect(card).toContainText("Buses & Minibuses");
  await card.getByRole("button", { name: "Disconnect E2E agent" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByTestId("snackbar")).toContainText("App disconnected");

  const revoked = await page.request.post("/api/mcp/s/kmb/mcp", { headers: { ...mcpHeaders, Authorization: `Bearer ${tokens.access_token}` }, data: rpc });
  expect(revoked.status()).toBe(401);
});

test("declining sends the client an access_denied error", async ({ page }) => {
  const { client_id } = await (await page.request.post("/api/mcp/oauth/register", { data: { client_name: "Declined agent", redirect_uris: [callback] } })).json();
  const query = new URLSearchParams({
    response_type: "code",
    client_id,
    redirect_uri: callback,
    code_challenge: crypto.createHash("sha256").update("x".repeat(43)).digest("base64url"),
    code_challenge_method: "S256",
    state: "no",
  });
  let returned: URL | null = null;
  await page.route(`${callback}**`, (route) => {
    returned = new URL(route.request().url());
    return route.fulfill({ status: 200, body: "ok" });
  });
  await page.goto(`/oauth/authorize?${query}`);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => returned?.searchParams.get("error") ?? null).toBe("access_denied");
  expect(returned!.searchParams.get("state")).toBe("no");
});
