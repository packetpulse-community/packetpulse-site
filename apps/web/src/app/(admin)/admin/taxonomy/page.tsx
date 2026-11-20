import { cookies } from "next/headers";
import { skillsServerApi } from "@/features/skills/api/skills.api";
import { TaxonomyAdmin } from "@/features/skills/components/TaxonomyAdmin";

export default async function AdminTaxonomyPage() {
  const cookieHeader = (await cookies()).toString();
  const [taxonomy, suggestions] = await Promise.all([
    skillsServerApi.adminList(cookieHeader),
    skillsServerApi.suggestions("pending", cookieHeader),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Skill taxonomy</h1>
        <p className="text-muted-foreground">
          The Major, Minor and Micro skills members pick from. Review what members suggest, add aliases, and retire skills nobody uses.
        </p>
      </div>
      <TaxonomyAdmin taxonomy={taxonomy} suggestions={suggestions} />
    </div>
  );
}
