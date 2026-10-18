import { tool } from "ai";
import { z } from "zod";

export const SIGN_OUT_TOOL_NAME = "sign_out";

export const SIGN_OUT_NOTE = `If the user asks to sign out, log out, unlink or disconnect their mcprouter account, in any words or language, call ${SIGN_OUT_TOOL_NAME}, then say goodbye in one short sentence; the bot confirms and sends a new sign-in link itself. Never call it for anything else.`;

/**
 * Lets the agent sign the user out of a chat bot when they ask in their own words.
 * The tool only records the request; the bot unlinks the account once the reply is done.
 */
export function signOutTool() {
  let requested = false;
  const tools = {
    [SIGN_OUT_TOOL_NAME]: tool({
      description: "Sign the user out: unlink this chat from their mcprouter account. Only when they ask to sign out, log out or unlink.",
      inputSchema: z.object({}),
      execute: async () => {
        requested = true;
        return { signedOut: true, note: "The account will be unlinked after this reply; a new sign-in link is sent automatically." };
      },
    }),
  };
  return { tools, requested: () => requested };
}
