import { LoginForm } from "@/features/auth/components/LoginForm";

interface LoginPageProps {
  searchParams: Promise<{ registered?: string; reset?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { registered, reset, next } = await searchParams;
  return <LoginForm justRegistered={registered === "true"} passwordReset={reset === "true"} next={next} />;
}
