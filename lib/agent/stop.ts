import { hasToolCall, type PrepareStepFunction, type StopCondition, type ToolSet } from "ai";
import { markLastMessage } from "./cache";
import { REQUEST_INPUT_TOOL_NAME } from "./user-input";
import { REQUEST_LOCATION_TOOL_NAME } from "./location";

export const AGENT_TOOL_STEPS = 40;
export const GUEST_AGENT_TOOL_STEPS = 24;

export const COMPLETION_NOTE = "Keep working until you have answered every part of the user's request. Searching for tools or collecting data is not completion. After tool calls, give a user-facing answer. If blocked, explain what is missing or request user input; never end with only tool activity.";

/** A tool-only step is never a completed reply. User-input tools intentionally yield. */
export const hasFinalAnswer: StopCondition<ToolSet> = ({ steps }) => {
  const last = steps.at(-1);
  return !!last && last.toolCalls.length === 0 && last.text.trim().length > 0;
};

/** Reserve one extra, tools-disabled step so the safety cap cannot leave a tool-only reply. */
export function agentLoop(toolSteps = AGENT_TOOL_STEPS) {
  const budget = Math.max(1, Math.floor(toolSteps));
  return {
    stopWhen: [
      hasFinalAnswer,
      hasToolCall(REQUEST_INPUT_TOOL_NAME, REQUEST_LOCATION_TOOL_NAME),
      (({ steps }) => steps.length >= budget + 1) satisfies StopCondition<ToolSet>,
    ],
    prepareStep: ({ messages, stepNumber }: Pick<Parameters<PrepareStepFunction<ToolSet>>[0], "messages" | "stepNumber">) => ({
      messages: markLastMessage(stepNumber >= budget ? [...messages, {
        role: "user" as const,
        content: "The tool budget for this reply is exhausted. Give your final answer using the results already collected. Clearly state any unfinished parts and missing information. Do not claim the task is complete unless all requested parts are done.",
      }] : messages),
      ...(stepNumber >= budget ? { toolChoice: "none" as const } : {}),
    }),
  };
}
