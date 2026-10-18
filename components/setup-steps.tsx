"use client";

import { ExternalLink } from "lucide-react";
import { CodeBlock } from "@/components/m3/code-block";
import { useT } from "@/lib/i18n/client";
import type { SetupStep } from "@/lib/mcp-clients";

/** Numbered setup steps for an MCP client, with copyable commands. Step text and link labels are msgids from `lib/mcp-clients`. */
export function SetupSteps({ steps }: { steps: SetupStep[] }) {
  const t = useT();
  return (
    <ol className="stagger flex flex-col gap-4">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-container type-label-large text-on-primary-container tabular-nums">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
            <p className="type-body-large">{t(step.text)}</p>
            {step.link ? (
              <a className="inline-flex items-center gap-1 self-start type-label-large text-primary underline" href={step.link.href} target="_blank" rel="noreferrer">
                {t(step.link.label)} <ExternalLink size={14} />
              </a>
            ) : null}
            {step.code ? <CodeBlock code={step.code} what={t("Copied")} /> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
