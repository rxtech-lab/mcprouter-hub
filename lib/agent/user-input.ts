import { tool } from "ai";
import { z } from "zod";

export const REQUEST_INPUT_TOOL_NAME = "request_user_input";
export const userInputSchema = z.object({
  question: z.string().trim().min(1).max(500),
  options: z.array(z.object({
    label: z.string().trim().min(1).max(100),
    description: z.string().trim().max(250).optional(),
  })).max(6).describe("Real choices from the user's context or tool results. Use [] for an open question; never invent streets, routes or other factual choices."),
});
export type UserInputRequest = z.infer<typeof userInputSchema>;

export const USER_INPUT_NOTE = `Format replies with Markdown: short paragraphs, bold key facts, lists for steps or choices, and tables for comparisons. Avoid a large heading for a simple question.
When you need a missing detail or a choice from the user, call request_user_input instead of only asking in prose. Ask one focused question in the user's language. Supply options only when grounded in the conversation or actual tool results; otherwise use an empty options array. The UI always allows a custom answer. This pauses your reply. Wait for the user's next message before continuing; do not guess their answer.`;

export function userInputTools() {
  return {
    [REQUEST_INPUT_TOOL_NAME]: tool({
      description: "Ask the user for a missing detail or a choice, with an interactive answer dialog. Stops this reply until the user answers in a new message.",
      inputSchema: userInputSchema,
      execute: async () => ({ awaitingUserInput: true }),
    }),
  };
}
