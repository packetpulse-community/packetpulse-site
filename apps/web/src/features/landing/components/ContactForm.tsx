"use client";

import { useState } from "react";
import { Send } from "lucide-react";

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const EMPTY_FORM: FormState = { name: "", email: "", subject: "", message: "" };

// No backend contact endpoint exists — rather than faking a "message sent" success
// state (as the old app's frontend-only simulated submit did), this opens the
// visitor's own email client via mailto: with the fields prefilled. That's an
// honest fallback: it actually hands off to something real instead of pretending
// to deliver a message that never left the browser.
export function ContactForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email address";
    if (!form.subject.trim()) next.subject = "Subject is required";
    if (!form.message.trim()) next.message = "Message is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const body = `${form.message}\n\n— ${form.name} (${form.email})`;
    const mailto = `mailto:packetpulse25@gmail.com?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const inputClass = (hasError: boolean) =>
    `w-full rounded-md border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand ${
      hasError ? "border-destructive" : "border-input"
    }`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium">
            Your Name
          </label>
          <input
            id="name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="John Doe"
            className={inputClass(Boolean(errors.name))}
          />
          {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium">
            Your Email
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="john@example.com"
            className={inputClass(Boolean(errors.email))}
          />
          {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="mb-2 block text-sm font-medium">
          Subject
        </label>
        <input
          id="subject"
          value={form.subject}
          onChange={(e) => updateField("subject", e.target.value)}
          placeholder="How can we help you?"
          className={inputClass(Boolean(errors.subject))}
        />
        {errors.subject && <p className="mt-1 text-sm text-destructive">{errors.subject}</p>}
      </div>

      <div>
        <label htmlFor="message" className="mb-2 block text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          rows={5}
          value={form.message}
          onChange={(e) => updateField("message", e.target.value)}
          placeholder="Your message here..."
          className={inputClass(Boolean(errors.message))}
        />
        {errors.message && <p className="mt-1 text-sm text-destructive">{errors.message}</p>}
      </div>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 md:w-auto"
      >
        Send Message
        <Send className="h-4 w-4" />
      </button>
      <p className="text-xs text-gray-400">Opens your email client with this message prefilled — there's no in-app inbox yet.</p>
    </form>
  );
}
