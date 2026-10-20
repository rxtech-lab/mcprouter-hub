"use server";

import { runAction } from "@/lib/action-result";
import { currentFreeChatQuota } from "@/lib/free-chat";
import { currentChatAllowance } from "@/lib/chat-allowance";

export async function getFreeChatQuota() {
  return runAction(() => currentFreeChatQuota());
}

export async function getChatAllowance() {
  return runAction(() => currentChatAllowance());
}
