import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Log in to PacketPulse</h1>
      <LoginForm />
      <p className="text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/register" className="text-primary underline">
          Register
        </Link>
      </p>
    </div>
  );
}
