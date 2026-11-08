import { redirect } from "next/navigation";

/** Keep existing task-agent links working through the shared Agent. */
export default function TaskAgentPage() {
  redirect("/chat");
}
