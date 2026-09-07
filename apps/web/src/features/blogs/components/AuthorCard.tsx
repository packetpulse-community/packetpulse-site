import type { BlogAuthor } from "../api/blogs.api";

export function AuthorCard({ author }: { author: BlogAuthor }) {
  const initials = `${author.firstName[0] ?? ""}${author.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="glass-panel flex items-center gap-4 rounded-lg border-t border-glass-border p-4">
      {author.avatarUrl ? (
        <img src={author.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white">
          {initials || "U"}
        </span>
      )}
      <div>
        <p className="font-semibold">
          {author.firstName} {author.lastName}
        </p>
        <p className="text-sm text-muted-foreground">PacketPulse contributor</p>
      </div>
    </div>
  );
}
