import { Reveal } from "@/shared/components/Reveal";

export function CommunityValues() {
  return (
    <section className="container py-20">
      <Reveal className="rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 p-10 text-center shadow-xl backdrop-blur-md">
        <h2 className="text-3xl font-semibold">Our Community Values</h2>
        <p className="mt-6 text-xl font-medium text-indigo-400">&ldquo;Learn, Teach, Share, Troubleshoot, Repeat&rdquo;</p>
        <p className="mx-auto mt-4 max-w-2xl text-gray-300">
          Our community is a platform for networking professionals to come together, share insights, and learn from
          each other's experience — no gatekeeping, just people helping people get better at the craft.
        </p>
      </Reveal>
    </section>
  );
}
