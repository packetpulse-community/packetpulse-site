import { LoginForm } from "@/features/auth/components/LoginForm";

interface LoginPageProps {
  searchParams: Promise<{ registered?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { registered } = await searchParams;
  return <LoginForm justRegistered={registered === "true"} />;
}
