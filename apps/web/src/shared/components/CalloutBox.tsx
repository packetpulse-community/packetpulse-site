export function CalloutBox({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass-panel-strong flex flex-col gap-3 rounded-lg border-indigo-500/30 p-6">
      <h3 className="text-lg font-semibold text-indigo-300">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children && <div className="flex flex-wrap gap-3">{children}</div>}
    </div>
  );
}
