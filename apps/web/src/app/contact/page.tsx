import type { Metadata } from "next";
import { MapPin, Mail, Phone } from "lucide-react";
import { MarketingBackground } from "@/features/landing/components/MarketingBackground";
import { Navbar } from "@/features/landing/components/Navbar";
import { Footer } from "@/features/landing/components/Footer";
import { ContactForm } from "@/features/landing/components/ContactForm";
import { Reveal } from "@/shared/components/Reveal";

export const metadata: Metadata = {
  title: "Contact | PacketPulse",
  description: "Have questions or suggestions? We'd love to hear from you.",
};

const CONTACT_DETAILS = [
  { icon: MapPin, label: "Our Location", value: "Bangalore, India, 560001", href: null },
  { icon: Mail, label: "Email Us", value: "packetpulse25@gmail.com", href: "mailto:packetpulse25@gmail.com" },
  { icon: Phone, label: "Call Us", value: "+91 8793700336", href: "tel:+918793700336" },
];

export default function ContactPage() {
  return (
    <MarketingBackground>
      <Navbar />
      <main className="container py-20">
        <Reveal className="mx-auto mb-16 flex max-w-2xl flex-col items-center gap-4 text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">Contact Us</h1>
          <p className="text-xl text-gray-300">Have questions or suggestions? We'd love to hear from you.</p>
        </Reveal>

        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
          <Reveal className="rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm lg:col-span-1">
            <h2 className="mb-6 text-2xl font-bold text-indigo-400">Get In Touch</h2>
            <p className="mb-8 text-gray-300">
              We're here to help and answer any questions you might have about PacketPulse. We look forward to
              hearing from you.
            </p>

            <div className="flex flex-col gap-6">
              {CONTACT_DETAILS.map((detail) => (
                <div key={detail.label} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                    <detail.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold">{detail.label}</h3>
                    {detail.href ? (
                      <a href={detail.href} className="text-indigo-400 hover:underline">
                        {detail.value}
                      </a>
                    ) : (
                      <p className="text-gray-300">{detail.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delayMs={150} className="rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm lg:col-span-2">
            <h2 className="mb-6 text-2xl font-bold text-indigo-400">Send Us a Message</h2>
            <ContactForm />
          </Reveal>
        </div>
      </main>
      <Footer />
    </MarketingBackground>
  );
}
