import { FeatureFlagsAdmin } from "@/features/admin/components/FeatureFlagsAdmin";

export default function AdminFeatureFlagsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Feature switches</h1>
        <p className="text-muted-foreground">
          Turn a feature off for everyone without a release. Every change asks for a reason and is written to the audit log. Existing content is never deleted.
        </p>
      </div>
      <FeatureFlagsAdmin />
    </div>
  );
}
