import { describe, expect, it } from "vitest";
import { SIGN_OUT_TOOL_NAME, signOutTool } from "@/lib/agent/sign-out-tool";

describe("signOutTool", () => {
  it("records the request when the agent calls it", async () => {
    const signOut = signOutTool();
    expect(signOut.requested()).toBe(false);
    const output = await signOut.tools[SIGN_OUT_TOOL_NAME].execute!({}, { toolCallId: "1", messages: [] } as never);
    expect(output).toMatchObject({ signedOut: true });
    expect(signOut.requested()).toBe(true);
  });

  it("keeps each reply's request separate", () => {
    expect(signOutTool().requested()).toBe(false);
  });
});
