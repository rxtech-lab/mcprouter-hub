"use server";

import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { chatIdSchema, deleteChat, listChats } from "@/lib/chat-store";

const listSchema = z.object({
  cursor: z.string().max(100).nullish(),
  query: z.string().max(100).nullish(),
});

export async function listChatHistory(input: z.input<typeof listSchema>) {
  return runAction(async () => {
    const user = await requireActionUser();
    return listChats(user.id, listSchema.parse(input));
  });
}

export async function deleteChatHistory(input: { id: string }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const { id } = z.object({ id: chatIdSchema }).parse(input);
    await deleteChat(user.id, id);
    return undefined;
  });
}
