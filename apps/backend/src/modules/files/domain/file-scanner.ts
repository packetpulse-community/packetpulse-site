import type { FileKind } from "@packetpulse/types";

export type ScanInput = {
  bucket: string;
  path: string;
  contentType: string;
  sizeBytes: number;
  kind: FileKind;
  // First bytes of the object (enough for signature checks).
  head: Buffer;
  // Reads the whole object (files are capped at FILE_MAX_BYTES). Only scanners that need the
  // full content (an antivirus) call it.
  readAll?: () => Promise<Buffer>;
};
export type ScanVerdict = { clean: boolean; reason: string };

// Thrown when a scanner cannot give a verdict (antivirus down, timeout, odd answer). The upload
// is then neither accepted nor destroyed: it stays pending and the caller may retry.
export class ScannerUnavailableError extends Error {}

// The scanning contract: bind an implementation to FileScanner in FilesModule. The default
// (SignatureFileScanner) only checks type and signature, it does NOT detect malware;
// ClamdFileScanner adds a real antivirus when CLAMAV_HOST is set.
export abstract class FileScanner {
  abstract scan(input: ScanInput): Promise<ScanVerdict>;
}
