"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X, Home, Info, Book, FileText, Phone, Search, LogIn, UserPlus, Wrench, LayoutDashboard } from "lucide-react";
import { BrandLogo } from "@/shared/components/BrandLogo";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { useSessionHint, type SessionHint } from "@/shared/auth/session-hint";
import { ThemeSwitch } from "@/shared/theme/ThemeSwitch";

const NAV_LINKS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/about", label: "About", Icon: Info },
  { href: "/resources", label: "Resources", Icon: Book },
  { href: "/blogs", label: "Blogs", Icon: FileText },
  { href: "/tools", label: "Tools", Icon: Wrench },
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
        "flex items-center gap-1.5 rounded-grove-control px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-surface-subtle hover:text-text",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

// Signed-in visitors see a Dashboard link instead of Sign In / Sign Up. Until the browser's
// presence cookie has been read (the first paint of a prerendered page) a same-size placeholder
// is shown, so the page never briefly claims the wrong state.
function AuthActions({ hint, mobile, onNavigate }: { hint: SessionHint; mobile?: boolean; onNavigate?: () => void }) {
  if (hint === "unknown") {
    return <div aria-hidden="true" className={mobile ? "h-20" : "h-9 w-44"} />;
  }
  if (hint === "signed-in") {
    return (
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={cn(buttonVariants({ variant: "default", size: mobile ? "default" : "sm" }), mobile ? "w-full" : "h-auto py-2")}
      >
        <LayoutDashboard className="mr-1.5 h-4 w-4" />
        Dashboard
      </Link>
    );
  }
  return (
    <>
      <Link
        href="/login"
        onClick={onNavigate}
        className={cn("flex items-center text-sm font-medium text-text-secondary transition-colors hover:text-text", !mobile && "px-3 py-2")}
      >
        <LogIn className="mr-1.5 h-4 w-4" />
        Sign In
      </Link>
      <Link
        href="/register"
        onClick={onNavigate}
        className={cn(buttonVariants({ variant: "default", size: mobile ? "default" : "sm" }), mobile ? "w-full" : "h-auto py-2")}
      >
        <UserPlus className="mr-1.5 h-4 w-4" />
        Sign Up
      </Link>
    </>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const sessionHint = useSessionHint();
  // The reference site's nav is only transparent-at-top on the home page — every
  // other page (about/contact/etc.) always shows the solid glass background,
  // confirmed against the live bundle's `transparent` prop usage.
  const isHome = pathname === "/";

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

  const showTransparent = isHome && !scrolled;

  return (
    <motion.header
      animate={{ y: hidden ? -100 : 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "sticky top-4 z-50 transition-all duration-300",
        scrolled && "floating-nav floating-nav-scrolled",
        showTransparent ? "bg-transparent" : "border border-border bg-surface/95 backdrop-blur",
      )}
    >
      <nav className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <BrandLogo priority />
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
              className="w-40 rounded-grove-control border border-control bg-surface py-1.5 pl-9 pr-3 text-sm text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <ThemeSwitch compact />
          <AuthActions hint={sessionHint} />
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileOpen((open) => !open);
            setHidden(false);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-grove-control text-text hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring lg:hidden"
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
            <ThemeSwitch className="self-start" />
            <div className="flex flex-col gap-3 pt-2">
              <AuthActions hint={sessionHint} mobile onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </motion.header>
  );
}
