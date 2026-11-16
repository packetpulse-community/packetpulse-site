import { Injectable } from "@nestjs/common";
import { FileScanner, ScanInput, ScanVerdict } from "./file-scanner";

const ascii = (b: Buffer, from: number, to: number) => b.subarray(from, to).toString("latin1");

const SIGNATURES: Record<string, (h: Buffer) => boolean> = {
  "application/pdf": (h) => ascii(h, 0, 5) === "%PDF-",
  "application/msword": (h) => h.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (h) =>
    h.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  "image/png": (h) => h.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  "image/jpeg": (h) => h.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  "image/webp": (h) => ascii(h, 0, 4) === "RIFF" && ascii(h, 8, 12) === "WEBP",
};

@Injectable()
export class SignatureFileScanner extends FileScanner {
  async scan(input: ScanInput): Promise<ScanVerdict> {
    const check = SIGNATURES[input.contentType];
    if (!check) return { clean: false, reason: `unsupported type ${input.contentType}` };
    if (!check(input.head)) return { clean: false, reason: `content does not match declared type ${input.contentType}` };
    return { clean: true, reason: "signature ok (no antivirus configured)" };
  }
}
