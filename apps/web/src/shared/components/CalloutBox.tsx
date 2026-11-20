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
    <div className="flex flex-col gap-3 rounded-grove-card border border-border bg-surface p-6">
      <h3 className="text-lg font-semibold text-primary-text">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children && <div className="flex flex-wrap gap-3">{children}</div>}
    </div>
  );
}
