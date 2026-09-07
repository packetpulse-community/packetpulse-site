"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { Reveal } from "@/shared/components/Reveal";

const TESTIMONIALS = [
  {
    quote:
      "PacketPulse has been instrumental in my career growth. The resources and community support are unmatched.",
    name: "Mai Anwar",
    title: "Network & Security Engineer",
  },
  {
    quote: "The troubleshooting guides and peer advice saved me countless hours. This community is a must for anyone in networking.",
    name: "Mohammed Sherif",
    title: "SDWAN Engineer",
  },
  {
    quote:
      "From certification guidance to real-world problem solving, PacketPulse offers everything a network professional needs.",
    name: "S. Ranjan",
    title: "Network Administrator",
  },
];

export function TestimonialsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => setActiveIndex((i) => (i + 1) % TESTIMONIALS.length), 6000);
    return () => clearInterval(interval);
  }, [paused]);

  const active = TESTIMONIALS[activeIndex]!;

  return (
    <section className="container py-20">
      <Reveal>
        <div className="mb-12 flex flex-col items-center gap-2 text-center">
          <h2 className="text-3xl font-semibold">What Our Members Say</h2>
          <p className="max-w-xl text-gray-300">Join hundreds of networking professionals who have transformed their careers.</p>
        </div>

        <div
          className="mx-auto flex max-w-2xl flex-col items-center gap-6 rounded-2xl glass-panel-strong p-8 text-center md:p-10"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <p className="text-lg italic text-foreground">&ldquo;{active.quote}&rdquo;</p>
          <div>
            <p className="font-semibold">{active.name}</p>
            <p className="text-sm text-gray-300">{active.title}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {TESTIMONIALS.map((testimonial, index) => (
            <button
              key={testimonial.name}
              type="button"
              aria-label={`View testimonial ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={cn("h-2 w-2 rounded-full transition-colors", index === activeIndex ? "bg-indigo-500" : "bg-muted")}
            />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
