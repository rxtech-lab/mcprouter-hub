/** Remounts on every sources navigation, so each page enters with the M3 shared-axis motion. */
export default function SourcesTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
