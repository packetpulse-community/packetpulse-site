import Link from "next/link";
import type { ResourceSummary } from "@/features/resources/api/resources.api";
import { Reveal } from "@/shared/components/Reveal";

export function LatestResources({ resources }: { resources: ResourceSummary[] }) {
  if (resources.length === 0) return null;

  return (
    <section className="container py-20">
      <div className="mb-12 flex flex-col items-center gap-2 text-center">
        <h2 className="text-3xl font-semibold">Latest Resources</h2>
        <p className="max-w-xl text-gray-300">
          Stay up-to-date with our most recent networking guides, tutorials, and case studies.
        </p>
        <Link href="/resources" className="mt-2 text-sm font-medium text-indigo-400 hover:underline">
          View All Resources &rarr;
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {resources.map((resource, index) => (
          <Reveal key={resource.id} delayMs={index * 100}>
            <Link
              href={`/resources/${resource.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              <div className="aspect-video w-full overflow-hidden bg-muted">
                {resource.thumbnailUrl ? (
                  <img
                    src={resource.thumbnailUrl}
                    alt={resource.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-300">No preview</div>
                )}
              </div>
              <div className="flex flex-col gap-2 p-4">
                <span className="w-fit rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium capitalize text-indigo-400">
                  {resource.resourceType.replace(/_/g, " ")}
                </span>
                <h3 className="font-semibold">{resource.title}</h3>
                <p className="text-sm text-gray-300">
                  By {resource.user.firstName} {resource.user.lastName}
                </p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
