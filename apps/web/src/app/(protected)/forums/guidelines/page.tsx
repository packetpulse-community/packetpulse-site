import { cookies } from "next/headers";
import Link from "next/link";
import { forumsServerApi } from "@/features/forums/api/forums.api";
import { GuidelinesActions } from "@/features/forums/components/GuidelinesActions";

export const metadata = { title: "Community guidelines" };

// SCR-046 (PRD-054): the rules, the steps a moderator takes and the appeals route. Linked from every post form.
export default async function GuidelinesPage() {
  const cookieHeader = (await cookies()).toString();
  const [guidelines, status] = await Promise.all([
    forumsServerApi.guidelines(cookieHeader),
    forumsServerApi.guidelinesStatus(cookieHeader).catch(() => null),
  ]);
  const paragraphs = guidelines.body.split(/\n+/).filter(Boolean);

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link href="/forums" className="text-sm text-muted-foreground hover:text-primary">
        ← Back to forums
      </Link>
      <h1 className="text-3xl font-semibold">Community guidelines</h1>
      <p className="text-sm text-muted-foreground">
        Version {guidelines.version} · published {new Date(guidelines.publishedAt).toLocaleDateString("en-IN", { dateStyle: "long" })}
      </p>
      <div className="flex flex-col gap-3 text-base leading-relaxed">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <p className="rounded-md border border-border bg-surface p-3 text-sm">Never post passwords, keys or customer data.</p>
      <GuidelinesActions status={status} />
    </article>
  );
}
