import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { SettingsForm } from "@/features/admin/components/SettingsForm";

export default async function AdminSettingsPage() {
  const cookieHeader = (await cookies()).toString();
  const settings = await adminServerApi.settings(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Application Settings</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
