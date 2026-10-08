import { ConfigService } from "@nestjs/config";

// Base URL for links the backend puts in front of users (emails, status checks).
// FRONTEND_URL when set; otherwise the first CORS origin — that's the deployed
// frontend by definition, so a host that forgot FRONTEND_URL (Render ignores
// render.yaml values unless the service is a Blueprint) still sends working links
// instead of http://localhost:3000.
export function frontendUrl(config: ConfigService): string {
  const explicit = config.get<string>("FRONTEND_URL");
  const firstOrigin = (config.get<string>("CORS_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .find(Boolean);
  return (explicit || firstOrigin || "http://localhost:3000").replace(/\/+$/, "");
}
