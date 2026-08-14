// Illustrative figures, not wired to real data — the only real aggregate-stats
// endpoint (GET /dashboard/stats) sits behind the auth guard chain and isn't
// reachable for anonymous visitors. Mixing one real number in with fabricated
// ones would be misleading, so the whole strip stays clearly illustrative
// (consistent with the hero's own "2000+ network professionals" copy).
const STATS = [
  { label: "Members", value: "2000+" },
  { label: "Resources", value: "500+" },
  { label: "Certifications", value: "50+" },
  { label: "Countries", value: "30+" },
];

export function StatsStrip() {
  return (
    <section className="container py-16">
      <h2 className="mb-10 text-center text-2xl font-semibold">Our Growth in Numbers</h2>
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center text-center">
            <p className="text-3xl font-bold text-brand sm:text-4xl">{stat.value}</p>
            <p className="mt-1 text-sm text-gray-300">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
