import { Library, FileText, Video, Radar, Award } from "lucide-react";
import { Reveal } from "@/shared/components/Reveal";

const OFFERINGS = [
  { icon: Library, title: "Resource Library", description: "A curated collection of technical documentation, guides, and best practices for network engineers." },
  { icon: FileText, title: "Blog Articles", description: "Member-written articles where the community reads, learns, and contributes back." },
  { icon: Video, title: "Expert Sessions", description: "Recorded presentations and tutorials from industry experts across networking topics." },
  { icon: Radar, title: "Network Tools", description: "Interactive tools for network diagnostics, monitoring, and visualization." },
  { icon: Award, title: "Certification Tracking", description: "Track your certification journey with resources tailored to where you're headed." },
];

export function AboutOffer() {
  return (
    <section className="container py-20">
      <h2 className="mb-12 text-center text-3xl font-semibold">What We Offer</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {OFFERINGS.map((offering, index) => (
          <Reveal
            key={offering.title}
            delayMs={index * 100}
            className="flex flex-col gap-3 rounded-xl bg-white/5 p-5 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            <offering.icon className="h-7 w-7 text-brand" />
            <h3 className="font-semibold">{offering.title}</h3>
            <p className="text-sm text-gray-300">{offering.description}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
