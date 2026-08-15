import { Calendar } from "lucide-react";
import { Reveal } from "@/shared/components/Reveal";

// Static placeholder — no events feature/backend exists in the new app, so
// there's no real schedule to show. Kept generic (no fabricated presenter
// names or times) rather than either inventing fake specifics or dropping
// the section outright, since the live reference site still has one.
const EVENTS = [
  { title: "Live Webinar", description: "Details announced soon." },
  { title: "Community Workshop", description: "Details announced soon." },
  { title: "Networking Q&A", description: "Details announced soon." },
];

export function UpcomingEvents() {
  return (
    <section className="container py-20">
      <div className="mb-12 flex flex-col items-center gap-2 text-center">
        <h2 className="text-3xl font-semibold">Upcoming Events</h2>
        <p className="max-w-xl text-gray-300">
          Join our live webinars, workshops, and networking sessions to enhance your skills.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {EVENTS.map((event, index) => (
          <Reveal key={event.title} delayMs={index * 100}>
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <Calendar className="h-5 w-5 text-indigo-400" />
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-400">Coming soon</span>
              </div>
              <h3 className="font-semibold">{event.title}</h3>
              <p className="text-sm text-gray-300">{event.description}</p>
              <button
                type="button"
                disabled
                title="Registration coming soon"
                className="mt-2 w-fit rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Register Now
              </button>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
