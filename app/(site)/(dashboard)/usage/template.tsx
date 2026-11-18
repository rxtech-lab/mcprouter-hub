/** Tab content fades through when the tab changes; the header and tabs stay put. */
export default function TabTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-through">{children}</div>;
}
