import Link from "next/link";
import Image from "next/image";

// A quiet shell for the onboarding flow: no member navigation until the required details are in.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="relative flex min-h-screen flex-col items-center bg-background px-4 py-12 text-text outline-none">
      <div className="w-full max-w-xl">
        <Link href="/" className="mx-auto mb-8 flex w-fit items-center justify-center">
          <Image src="/logo.png" alt="PacketPulse" width={140} height={54} className="h-14 w-auto" priority />
        </Link>
        <div className="rounded-grove-card border border-border bg-surface p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
