"use server";

import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { callExternalTool, callOwnTool, externalToolApp, ownToolApp, splitToolName } from "@/lib/agent/mcp-apps";
import { requireActionUser } from "@/lib/auth";

const toolName = z.string().min(1).max(200);
const resourceUri = z.string().startsWith("ui://").max(500);
const toolArguments = z.record(z.string(), z.unknown()).default({});

/** The MCP App HTML for a tool part. This app's apps are public, like its tool list; other servers need a member. */
export async function loadToolApp(chatToolName: string, uri: string) {
  return runAction(async () => {
    const name = toolName.parse(chatToolName);
    const { server } = splitToolName(name);
    if (!server) return ownToolApp(resourceUri.parse(uri), name);
    await requireActionUser();
    return externalToolApp(server, resourceUri.parse(uri));
  });
}

/**
 * An app's own `tools/call`, e.g. its refresh button. Signed-in members only,
 * and billed like any other call; the free agent's apps can't call tools.
 */
export async function callAppTool(chatToolName: string, name: string, args: unknown) {
  return runAction(async () => {
    const user = await requireActionUser();
    const openedBy = toolName.parse(chatToolName);
    const input = toolArguments.parse(args ?? {});
    const { server } = splitToolName(openedBy);
    if (!server) return callOwnTool({ userId: user.id, apiKeyId: null, scopes: [] }, openedBy, toolName.parse(name), input);
    return callExternalTool(server, toolName.parse(name), input);
  });
}
