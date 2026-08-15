interface UserDistributionBarsProps {
  data: { role: string; count: number }[];
}

export function UserDistributionBars({ data }: UserDistributionBarsProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;

  if (data.length === 0) {
    return <p className="text-muted-foreground">No role data available.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((d) => (
        <div key={d.role} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="capitalize text-foreground">{d.role}</span>
            <span className="text-muted-foreground">{d.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(d.count / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
