"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X, Home, Info, Book, FileText, Phone, Search, LogIn, UserPlus } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

const NAV_LINKS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/about", label: "About", Icon: Info },
  { href: "/resources", label: "Resources", Icon: Book },
  { href: "/blogs", label: "Blogs", Icon: FileText },
  { href: "/contact", label: "Contact", Icon: Phone },
];

function NavLink({
  href,
  label,
  Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  Icon: typeof Home;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
        active ? "bg-indigo-600 text-white shadow-md" : "text-muted-foreground hover:bg-indigo-600/50 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  const { scrollY } = useScroll();
  const lastScrollY = useRef(0);

  useMotionValueEvent(scrollY, "change", (current) => {
    const previous = lastScrollY.current;
    setScrolled(current > 10);
    // Never hide the mobile menu mid-scroll — it'd clip open links off-screen.
    if (!mobileOpen) {
      setHidden(current > previous && current > 120);
    }
    lastScrollY.current = current;
  });

  return (
    <motion.header
      animate={{ y: hidden ? -100 : 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "floating-nav sticky top-4 z-50 transition-colors",
        scrolled ? "floating-nav-scrolled bg-background/90" : "bg-background/80",
      )}
    >
      <nav className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/logo.png" alt="PacketPulse" width={140} height={54} className="h-10 w-auto" priority />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} {...link} active={link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)} />
          ))}
        </div>

        <div className="hidden flex-1 items-center justify-end gap-3 lg:flex">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search"
              disabled
              title="Search coming soon"
              className="w-40 rounded-md border border-input bg-background py-1.5 pl-9 pr-3 text-sm text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <Link href="/login" className="flex items-center px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <LogIn className="mr-1.5 h-4 w-4" />
            Sign In
          </Link>
          <Link href="/register" className={cn(buttonVariants({ variant: "gradient", size: "sm" }), "h-auto py-2")}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Sign Up
          </Link>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileOpen((open) => !open);
            setHidden(false);
          }}
          className="lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {mobileOpen ? (
        <div className="border-t border-border lg:hidden">
          <div className="container flex flex-col gap-2 py-4">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                {...link}
                active={link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)}
                onClick={() => setMobileOpen(false)}
              />
            ))}
            <div className="flex flex-col gap-3 pt-2">
              <Link href="/login" className="flex items-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
                <LogIn className="mr-1.5 h-4 w-4" />
                Sign In
              </Link>
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: "gradient" }), "w-full")}
                onClick={() => setMobileOpen(false)}
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </motion.header>
  );
}
