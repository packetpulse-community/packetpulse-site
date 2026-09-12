import { VerifyEmailStatus } from "@/features/auth/components/VerifyEmailStatus";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  return <VerifyEmailStatus token={token ?? null} />;
}
