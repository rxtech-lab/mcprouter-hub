import { describe, expect, it } from "vitest";
import { userInputSchema, userInputTools } from "@/lib/agent/user-input";

describe("user input requests", () => {
  it("allows open questions and rejects empty or oversized requests", () => {
    expect(userInputSchema.parse({ question: "Which street?", options: [] }).options).toEqual([]);
    expect(userInputSchema.safeParse({ question: " ", options: [] }).success).toBe(false);
    expect(userInputSchema.safeParse({ question: "Which street?", options: Array.from({ length: 7 }, () => ({ label: "Street" })) }).success).toBe(false);
    expect(userInputSchema.safeParse({ question: "Which street?", options: [{ label: "" }] }).success).toBe(false);
  });

  it("acknowledges a question without claiming the user answered it", async () => {
    const tool = userInputTools().request_user_input;
    expect(await tool.execute!({ question: "Which street?", options: [] }, { toolCallId: "ask", messages: [], context: {} })).toEqual({ awaitingUserInput: true });
  });
});
