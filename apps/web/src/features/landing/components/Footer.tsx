import Link from "next/link";
import Image from "next/image";
import { Send, MessageCircle } from "lucide-react";

// lucide-react dropped brand/logo icons (trademark reasons) — small inline SVGs
// for the two brand marks it no longer ships, rather than pulling in a whole
// separate icon package for two glyphs.
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

const QUICK_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/resources", label: "Resources" },
  { href: "/recordings", label: "Recordings" },
  { href: "/blogs", label: "Blogs" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Sign In" },
  { href: "/register", label: "Join Us" },
];

// Same real accounts the reference community site (packetpulse.vercel.app) links to.
const SOCIAL_LINKS = [
  { href: "https://www.instagram.com/i.magnet", label: "Instagram", Icon: InstagramIcon },
  { href: "https://chat.whatsapp.com/G44DznPtetSFvKV3HoGTdX", label: "WhatsApp", Icon: MessageCircle },
  { href: "https://t.me/a64Ulse", label: "Telegram", Icon: Send },
  { href: "https://www.linkedin.com/in/sumit-kashyap-443635250", label: "LinkedIn", Icon: LinkedinIcon },
];

export function Footer() {
  return (
    // Solid bg (matches reference's bg-slate-900) — deliberately breaks out of the
    // page's gradient background (see MarketingBackground) rather than continuing it.
    <footer className="border-t border-white/10 bg-background">
      <div className="container grid gap-10 py-14 md:grid-cols-3">
        <div className="flex flex-col gap-4">
          <Link href="/">
            <Image src="/logo.png" alt="PacketPulse" width={140} height={54} className="h-9 w-auto" />
          </Link>
          <p className="max-w-xs text-sm text-gray-300">
            A thriving community of networking professionals. Learn, share, and advance your networking career.
          </p>
          <div className="flex gap-3">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="text-gray-300 transition-colors hover:text-brand"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold">Quick Links</h3>
          <ul className="flex flex-col gap-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.href + link.label}>
                <Link href={link.href} className="text-sm text-gray-300 transition-colors hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold">Contact Us</h3>
          <ul className="flex flex-col gap-2 text-sm text-gray-300">
            <li>
              <a href="mailto:packetpulse25@gmail.com" className="hover:text-foreground">
                packetpulse25@gmail.com
              </a>
            </li>
            <li>Bangalore, India, 560001</li>
            <li>
              <a href="tel:+918793700336" className="hover:text-foreground">
                +91 8793700336
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-6 text-center text-sm text-gray-300">
        © {new Date().getFullYear()} Packet Pulse. All rights reserved.
      </div>
    </footer>
  );
}
