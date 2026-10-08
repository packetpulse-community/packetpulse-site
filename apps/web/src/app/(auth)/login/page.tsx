import { LoginForm } from "@/features/auth/components/LoginForm";

interface LoginPageProps {
  searchParams: Promise<{ registered?: string; reset?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { registered, reset } = await searchParams;
  return <LoginForm justRegistered={registered === "true"} passwordReset={reset === "true"} />;
}
