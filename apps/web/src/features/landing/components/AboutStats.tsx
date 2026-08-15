import { Reveal } from "@/shared/components/Reveal";

// Deliberately different figures than the homepage's StatsStrip — matches the
// reference site's own inconsistency between its home and about pages rather
// than inventing a consistency that isn't actually there. Both are illustrative.
const STATS = [
  { label: "Active Users", value: "1,500+" },
  { label: "Resources Shared", value: "2,200+" },
  { label: "Community Posts", value: "100+" },
  { label: "Certifications Tracked", value: "15+" },
];

export function AboutStats() {
  return (
    <section className="container grid grid-cols-2 gap-6 py-14 sm:grid-cols-4">
      {STATS.map((stat, index) => (
        <Reveal
          key={stat.label}
          delayMs={index * 100}
          className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm transition-colors hover:border-indigo-500/50"
        >
          <p className="text-3xl font-bold text-indigo-400 sm:text-4xl">{stat.value}</p>
          <p className="mt-1 text-sm text-gray-300">{stat.label}</p>
        </Reveal>
      ))}
    </section>
  );
}
