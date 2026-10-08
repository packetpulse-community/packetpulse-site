import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Wrench } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

export const metadata: Metadata = {
  title: "Under maintenance — PacketPulse",
  robots: { index: false },
};

// Static on purpose: it makes no API calls, so it renders even when the backend
// is the thing being worked on. Every maintenance 503 from the API lands here
// (shared/api/http-client.ts).
export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-indigo-900 px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Image src="/logo.png" alt="PacketPulse" width={140} height={54} className="h-14 w-auto" priority />
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15">
          <Wrench className="h-8 w-8 text-amber-400" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">We&apos;re under maintenance</h1>
          <p className="text-muted-foreground">
            PacketPulse is getting some scheduled upgrades. Everything will be back shortly — thanks for your
            patience.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Link href="/" className={cn(buttonVariants({ variant: "gradient" }), "w-full")}>
            Try again
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground underline hover:text-foreground">
            Administrator sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
