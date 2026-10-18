import { CodeBlock } from "@/components/m3/code-block";
import type { SetupStep } from "@/lib/mcp-clients";

/** Numbered setup steps for an MCP client, with copyable commands. */
export function SetupSteps({ steps }: { steps: SetupStep[] }) {
  return (
    <ol className="stagger flex flex-col gap-4">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-container type-label-large text-on-primary-container tabular-nums">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
            <p className="type-body-large">{step.text}</p>
            {step.code ? <CodeBlock code={step.code} what="Copied" /> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
