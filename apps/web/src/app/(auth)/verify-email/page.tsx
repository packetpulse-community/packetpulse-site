import { VerifyEmailStatus } from "@/features/auth/components/VerifyEmailStatus";
import { VerifyEmailCodeForm } from "@/features/auth/components/VerifyEmailCodeForm";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string; next?: string; sent?: string }>;
}

// A link from an email carries ?token= (the 24 h link, kept alongside the code); everything else
// lands on the 6-digit code screen (PRD-001).
export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token, next, sent } = await searchParams;
  if (token) return <VerifyEmailStatus token={token} />;
  return <VerifyEmailCodeForm next={next ?? null} codeJustSent={sent === "1"} />;
}
