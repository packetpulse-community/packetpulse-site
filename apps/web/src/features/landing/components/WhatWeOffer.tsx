import Link from "next/link";
import { MessageSquare, Library, Video } from "lucide-react";

const OFFERINGS = [
  {
    icon: MessageSquare,
    title: "Discussion Blogs",
    description: "Connect with peers, ask questions, and share your knowledge in our active community blogs.",
    href: "/blogs",
    cta: "Join discussions",
  },
  {
    icon: Library,
    title: "Resource Library",
    description: "Access our curated collection of technical documentation, guides, and best practices.",
    href: "/resources",
    cta: "Browse resources",
  },
  {
    icon: Video,
    title: "Session Recordings",
    description: "Watch recorded sessions from industry experts covering various networking topics.",
    href: "/recordings",
    cta: "View recordings",
  },
];

export function WhatWeOffer() {
  return (
    <section className="container py-20">
      <h2 className="mb-12 text-center text-3xl font-semibold">What We Offer</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {OFFERINGS.map((offering) => (
          <article key={offering.title} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <offering.icon className="h-8 w-8 text-brand" />
            <h3 className="text-xl font-semibold">{offering.title}</h3>
            <p className="flex-1 text-sm text-muted-foreground">{offering.description}</p>
            <Link href={offering.href} className="text-sm font-medium text-brand hover:underline">
              {offering.cta} &rarr;
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
