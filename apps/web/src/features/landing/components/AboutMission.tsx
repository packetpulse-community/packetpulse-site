import { Sparkles, Users, ShieldCheck } from "lucide-react";

const VALUES = [
  {
    icon: Sparkles,
    title: "Continuous Learning",
    description: "Networking never stands still, and neither do we — there's always another protocol, another outage, another thing worth understanding better.",
  },
  {
    icon: Users,
    title: "Community Support",
    description: "The fastest way through a hard problem is usually someone who's already hit it. We built this place so that person is easy to find.",
  },
  {
    icon: ShieldCheck,
    title: "Technical Excellence",
    description: "Guides and resources here are written by people who actually run the gear, not just read the datasheet.",
  },
];

export function AboutMission() {
  return (
    <section className="container flex flex-col gap-16 py-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 text-center">
        <h2 className="text-3xl font-semibold">Our Mission</h2>
        <p className="text-gray-300">
          PacketPulse exists to give networking professionals a place to learn from each other, not just from vendor
          documentation. Whatever stage you're at — student, fresher, or a decade deep in the field — there's someone
          here who's already solved the problem you're stuck on.
        </p>
        <p className="text-gray-300">
          We bring together engineers at every level to troubleshoot, share resources, and keep up with a field that
          changes faster than any single person can track alone.
        </p>
      </div>

      <div>
        <h3 className="mb-8 text-center text-2xl font-semibold">Our Core Values</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {VALUES.map((value) => (
            <div key={value.title} className="flex flex-col gap-3 rounded-xl bg-white/5 p-6 backdrop-blur-sm transition-colors hover:bg-white/10">
              <value.icon className="h-8 w-8 text-brand" />
              <h4 className="font-semibold">{value.title}</h4>
              <p className="text-sm text-gray-300">{value.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
