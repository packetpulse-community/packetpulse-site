import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <Link href="/" className="absolute right-6 top-6 text-sm text-muted-foreground transition-colors hover:text-foreground">
        Back to Home
      </Link>

      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-8 flex w-fit items-center justify-center">
          <Image src="/logo.png" alt="PacketPulse" width={140} height={54} className="h-14 w-auto" priority />
        </Link>

        {children}
      </div>
    </div>
  );
}
