interface UserGrowthChartProps {
  data: { date: string; count: number }[];
}

// Real bar chart from actual registration counts — the old dashboard's equivalent
// ("User Growth") read a response shape the backend never sent and silently fell
// back to Math.random()-generated bars every render. This one is fed by
// AdminAnalytics.registrationTrend, a real day-bucketed aggregate.
export function UserGrowthChart({ data }: UserGrowthChartProps) {
  if (data.length === 0) {
    return <p className="text-muted-foreground">No registrations in this window.</p>;
  }

  const max = Math.max(...data.map((p) => p.count), 1);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Daily registrations</span>
        <span>Max: {max}</span>
      </div>
      <div className="flex items-end gap-1" style={{ height: 160 }}>
        {data.map((point) => (
          <div
            key={point.date}
            title={`${point.date}: ${point.count}`}
            className="flex-1 rounded-t bg-primary transition-all hover:bg-primary/80"
            style={{ height: `${(point.count / max) * 100}%`, minHeight: 2 }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {data.map((point, i) => (
          <span key={point.date} className="flex-1 text-center">
            {i % labelEvery === 0 ? point.date.slice(5) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
