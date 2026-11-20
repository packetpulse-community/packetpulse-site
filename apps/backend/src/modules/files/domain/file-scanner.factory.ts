import { Logger } from "@nestjs/common";
import { ClamdFileScanner } from "./clamav-file-scanner";
import { FileScanner } from "./file-scanner";

// CLAMAV_HOST unset = signature check only. CLAMAV_PORT defaults to clamd's 3310.
export function createFileScanner(signature: FileScanner, env: NodeJS.ProcessEnv = process.env): FileScanner {
  const host = env.CLAMAV_HOST?.trim();
  if (!host) return signature;
  const port = Number(env.CLAMAV_PORT || 3310);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("CLAMAV_PORT must be a port number");
  const timeoutMs = env.CLAMAV_TIMEOUT_MS ? Number(env.CLAMAV_TIMEOUT_MS) : undefined;
  new Logger("FileScanner").log(`ClamAV scanning enabled (${host}:${port})`);
  return new ClamdFileScanner(signature, { host, port, timeoutMs });
}
