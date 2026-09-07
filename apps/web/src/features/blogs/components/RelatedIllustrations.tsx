import type { BlogImage } from "../api/blogs.api";

export function RelatedIllustrations({ images }: { images: BlogImage[] }) {
  if (images.length === 0) return null;

  const sorted = [...images].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Related Illustrations</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sorted.map((image, index) => (
          <a
            key={image.id}
            href={image.url}
            target="_blank"
            rel="noreferrer"
            className="glass-panel glass-interactive group flex flex-col overflow-hidden rounded-lg"
          >
            <div className="relative">
              <img src={image.url} alt={`Figure ${index + 1}`} className="h-48 w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                Click to enlarge
              </div>
            </div>
            <p className="p-2 text-xs text-muted-foreground">Figure {index + 1}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
