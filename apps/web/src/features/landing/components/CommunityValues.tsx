import { Reveal } from "@/shared/components/Reveal";

export function CommunityValues() {
  return (
    <section className="container py-20">
      <Reveal className="rounded-2xl border border-border bg-primary/10 p-10 text-center">
        <h2 className="text-3xl font-semibold">Our Community Values</h2>
        <p className="mt-6 text-xl font-medium text-primary-text">&ldquo;Learn, Teach, Share, Troubleshoot, Repeat&rdquo;</p>
        <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
          Our community is a platform for networking professionals to come together, share insights, and learn from
          each other's experience — no gatekeeping, just people helping people get better at the craft.
        </p>
      </Reveal>
    </section>
  );
}
