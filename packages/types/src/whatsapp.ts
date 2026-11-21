import { z } from "zod";

// WhatsApp number rules (PRD-006), kept free of other imports so auth.ts and users.ts can use them.


/** Default country when a number is typed without a country code. */
export const DEFAULT_COUNTRY_CALLING_CODE = "91";

export const WHATSAPP_FORMAT_HINT = "Enter a 10-digit Indian mobile number, or a number with its country code, e.g. +91 98765 43210";

/**
 * Normalises a typed number to E.164 ("+919876543210"), or returns null when it is not a usable
 * number. A bare 10-digit number starting 6-9 (also with a leading 0 or 91) is an Indian mobile;
 * anything else must start with "+" (or "00") and be 8-15 digits, the E.164 limit. Indian
 * numbers (+91) must still be a valid mobile. Spaces, dashes, dots and brackets are ignored.
 */
export function normaliseWhatsappNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\+?[\d\s\-.()]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  let international = trimmed.startsWith("+");
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }
  const indianMobile = /^[6-9]\d{9}$/;
  if (!international) {
    if (indianMobile.test(digits)) return `+${DEFAULT_COUNTRY_CALLING_CODE}${digits}`;
    if (digits.length === 11 && digits.startsWith("0") && indianMobile.test(digits.slice(1))) {
      return `+${DEFAULT_COUNTRY_CALLING_CODE}${digits.slice(1)}`;
    }
    if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CALLING_CODE) && indianMobile.test(digits.slice(2))) {
      return `+${digits}`;
    }
    return null;
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (digits.startsWith(DEFAULT_COUNTRY_CALLING_CODE) && !indianMobile.test(digits.slice(2))) return null;
  return `+${digits}`;
}

/** Optional number: blank means "not given"; anything else must normalise. Output is E.164. */
export const OptionalWhatsappNumberSchema = z
  .string()
  .max(40)
  .optional()
  .transform((value, ctx): string | undefined => {
    if (value === undefined || value.trim() === "") return undefined;
    const normalised = normaliseWhatsappNumber(value);
    if (!normalised) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: WHATSAPP_FORMAT_HINT });
      return z.NEVER;
    }
    return normalised;
  });

