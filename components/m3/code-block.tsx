import { CopyIconButton } from "./copy-button";

export function CodeBlock({ code, label, what }: { code: string; label?: string; what?: string }) {
  return (
    <div className="relative rounded-sm bg-surface-container-highest">
      {label ? <div className="px-4 pt-3 type-label-medium text-on-surface-variant">{label}</div> : null}
      <pre className="overflow-x-auto px-4 py-3 pr-12 font-mono text-[13px] leading-5 text-on-surface">{code}</pre>
      <div className="absolute top-1 right-1">
        <CopyIconButton value={code} what={what ?? label ?? "Copied"} />
      </div>
    </div>
  );
}
