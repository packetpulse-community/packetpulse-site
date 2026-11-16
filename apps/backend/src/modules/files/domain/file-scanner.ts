import type { FileKind } from "@packetpulse/types";

export type ScanInput = {
  bucket: string;
  path: string;
  contentType: string;
  sizeBytes: number;
  kind: FileKind;
  // First bytes of the object (enough for signature checks).
  head: Buffer;
};
export type ScanVerdict = { clean: boolean; reason: string };

// Hook for a real antivirus (ClamAV, a cloud scanner, ...): bind a different implementation
// to FileScanner in FilesModule. The default only checks type and signature, it does NOT
// detect malware.
export abstract class FileScanner {
  abstract scan(input: ScanInput): Promise<ScanVerdict>;
}
