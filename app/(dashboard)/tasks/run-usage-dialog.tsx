"use client";
import { useRouter } from "next/navigation";
import { NativeDialog } from "@/components/native-dialog";
import { Button } from "@/components/m3/button";

type RunUsage = { id: string; usageTracked: boolean; chatUnits: number; chatChargedUnits: number; mcpCalls: number; mcpUnits: number; premiumMcpUnits: number; mcpChargedUnits: number; status: string };
export function RunUsageDialog({ taskId, run }: { taskId: string; run: RunUsage }) {
  const router = useRouter();
  const close = () => router.push(`/tasks/${taskId}?tab=history`);
  return <NativeDialog title="Run usage" onClose={close}>
    {run.usageTracked ? <><p className="mb-5 text-on-surface-variant">Consumption recorded for this run{run.status === "running" ? " so far. Totals update as the task runs." : ". Failed runs can still consume allowance."}</p><dl className="divide-y divide-outline-variant">{[
      ["Chat allowance consumed", `${run.chatUnits} units`], ["Chat overage charged", `${run.chatChargedUnits} credits`], ["MCP calls attempted", String(run.mcpCalls)], ["Standard MCP allowance consumed", `${run.mcpUnits} units`], ["Premium MCP allowance consumed", `${run.premiumMcpUnits} units`], ["MCP overage charged", `${run.mcpChargedUnits} credits`],
    ].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 py-3"><dt className="text-on-surface-variant">{label}</dt><dd className="shrink-0 font-medium tabular-nums">{value}</dd></div>)}</dl><p className="mt-5 type-body-small text-on-surface-variant">Ordinary MCP tools are included in a billed chat unit. Premium tools may consume a separate allowance. External MCP providers may bill separately; their charges are not available here. When billing is disabled, allowance consumption is zero.</p></> : <p className="text-on-surface-variant">Usage was not recorded for this earlier run. New runs include chat and MCP consumption.</p>}
    <div className="mt-6 flex justify-end"><Button onClick={close}>Close</Button></div>
  </NativeDialog>;
}
