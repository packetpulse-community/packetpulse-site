import { Reveal } from "@/shared/components/Reveal";

export function AboutHero() {
  return (
    <section className="container py-20">
      <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">About PacketPulse</h1>
        <p className="max-w-xl text-lg text-gray-300">
          Empowering network engineers through community, knowledge sharing, and professional growth.
        </p>
      </Reveal>
    </section>
  );
}
