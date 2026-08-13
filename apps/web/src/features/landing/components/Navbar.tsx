"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/resources", label: "Resources" },
  { href: "/blogs", label: "Blogs" },
  { href: "/recordings", label: "Recordings" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <nav className="container flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Packet<span className="text-brand">Pulse</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
          >
            Sign Up
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {mobileOpen ? (
        <div className="border-t border-border md:hidden">
          <div className="container flex flex-col gap-4 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 pt-2">
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-brand px-4 py-2 text-center text-sm font-medium text-brand-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
