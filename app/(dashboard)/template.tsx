/** Remounts on every top-level dashboard navigation, so each page enters with the M3 shared-axis motion. */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
