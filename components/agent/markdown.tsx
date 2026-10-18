import { createElement, memo, type ElementType } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";

// Renders `tag` with fixed classes, dropping react-markdown's `node` prop.
function styled(tag: ElementType, className: string, extra?: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Styled = ({ node, ...props }: { node?: unknown }) => createElement(tag, { className, ...extra, ...props });
  return Styled;
}

// Agent replies are Markdown. Elements are mapped to M3 type scale and colour roles.
const components: Components = {
  p: styled("p", "my-2 first:mt-0 last:mb-0"),
  a: styled("a", "text-primary underline underline-offset-2", { target: "_blank", rel: "noreferrer" }),
  h1: styled("h1", "mt-4 mb-2 type-headline-small first:mt-0"),
  h2: styled("h2", "mt-4 mb-2 type-title-large first:mt-0"),
  h3: styled("h3", "mt-3 mb-1 type-title-medium first:mt-0"),
  h4: styled("h4", "mt-3 mb-1 type-title-small first:mt-0"),
  ul: styled("ul", "my-2 list-disc space-y-1 pl-6"),
  ol: styled("ol", "my-2 list-decimal space-y-1 pl-6"),
  li: styled("li", "pl-1"),
  blockquote: styled("blockquote", "my-2 border-l-4 border-outline-variant pl-4 text-on-surface-variant"),
  hr: styled("hr", "my-4 border-outline-variant"),
  code: styled("code", "rounded-xs bg-surface-container-highest px-1 py-0.5 font-mono text-[0.875em]"),
  pre: styled("pre", "my-2 overflow-x-auto rounded-sm bg-surface-container-highest p-3 font-mono text-sm [&_code]:bg-transparent [&_code]:p-0"),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  table: ({ node, ...props }) => (
    <div className="my-2 overflow-x-auto rounded-sm border border-outline-variant">
      <table className="w-full border-collapse type-body-medium" {...props} />
    </div>
  ),
  thead: styled("thead", "bg-surface-container"),
  th: styled("th", "border-b border-outline-variant px-3 py-2 text-left type-label-large"),
  td: styled("td", "border-b border-outline-variant px-3 py-2 align-top"),
};

export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkCjkFriendly]} components={components}>
      {children}
    </ReactMarkdown>
  );
});
