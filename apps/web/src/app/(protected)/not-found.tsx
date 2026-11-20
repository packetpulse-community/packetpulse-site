import { NotFoundScreen } from "@/shared/components/NotFoundScreen";

// Shown inside the shell when a page calls notFound() (for example a deleted resource).
export default function ProtectedNotFound() {
  return <NotFoundScreen mode="embedded" />;
}
