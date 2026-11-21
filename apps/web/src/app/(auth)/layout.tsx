import Link from "next/link";
import Image from "next/image";
import { SessionAwareBanner } from "@/shared/auth/SessionAwareBanner";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="relative flex min-h-screen flex-col items-center justify-center bg-background text-text px-4 py-16 outline-none">
      <Link href="/" className="absolute right-6 top-6 text-sm text-text-secondary transition-colors hover:text-text">
        Back to Home
      </Link>

      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-8 flex w-fit items-center justify-center">
          <Image src="/logo.png" alt="PacketPulse" width={140} height={54} className="h-14 w-auto" priority />
        </Link>

        <SessionAwareBanner />
        <div className="rounded-grove-card border border-border bg-surface p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
