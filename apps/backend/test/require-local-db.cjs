/* eslint-disable */
// TASK-003 guard: the e2e suite creates and deletes users, so it must never run
// against a remote database. apps/backend/.env may point at the hosted Supabase
// project, and Nest's ConfigModule would happily load it when DATABASE_URL is not
// set in the shell. This file is used twice:
//   1. as jest `globalSetup` (test/jest-e2e.json) - last line of defence;
//   2. as a script (`node test/require-local-db.cjs`) run first by `pnpm test:e2e`
//      so the failure is immediate and clearly worded.
// Allowed hosts: localhost, 127.0.0.1, ::1 and the compose service name `postgres`.
const fs = require("node:fs");
const path = require("node:path");

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);

// Mirrors what ConfigModule does: the shell environment wins, .env fills gaps.
function readDotEnvValue(key) {
  try {
    const file = path.join(__dirname, "..", ".env");
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0 || line.slice(0, eq).trim() !== key) continue;
      return line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch {
    /* no .env file */
  }
  return undefined;
}

function effectiveDatabaseUrl() {
  return process.env.DATABASE_URL || readDotEnvValue("DATABASE_URL");
}

function hostOf(url) {
  try {
    // URL() reports IPv6 hosts as "[::1]".
    return new URL(url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return null;
  }
}

function assertLocalDatabase() {
  const url = effectiveDatabaseUrl();
  const host = url ? hostOf(url) : null;
  if (host && ALLOWED_HOSTS.has(host)) return;
  const shown = host ? `host "${host}"` : url ? "an unparseable DATABASE_URL" : "no DATABASE_URL";
  throw new Error(
    [
      "",
      `REFUSING TO RUN E2E TESTS: DATABASE_URL points at ${shown}, which is not a local database.`,
      "The e2e suite creates and deletes users; it must never touch a remote or shared database.",
      "Allowed hosts: localhost, 127.0.0.1, ::1, postgres (docker compose service).",
      "",
      "Run it against the local docker services instead (docker compose up -d), e.g. from apps/backend:",
      "  env DATABASE_URL=postgresql://packetpulse:packetpulse@localhost:5433/packetpulse \\",
      "      REDIS_URL=redis://localhost:6380 NODE_ENV=test PLATFORM_MODE=docker pnpm test:e2e",
      "See docs/ops/environments.md.",
      "",
    ].join("\n"),
  );
}

module.exports = async function globalSetup() {
  assertLocalDatabase();
};
module.exports.assertLocalDatabase = assertLocalDatabase;

if (require.main === module) {
  try {
    assertLocalDatabase();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
