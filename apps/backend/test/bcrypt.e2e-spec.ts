import * as bcrypt from "bcrypt";
import { LocalCredentialProvider } from "../src/modules/identity/infrastructure/local/local-credential.provider";

// bcrypt 5.1.1 -> 6.0.0 (TASK-011): password hashes already stored in the database were
// created by bcrypt 5 and must keep verifying, and the API we call must be unchanged.
describe("bcrypt 6 compatibility", () => {
  // Generated with bcrypt 5.1.1: bcrypt.hashSync("Legacy-Passw0rd!", 10)
  const LEGACY_V5_HASH = "$2b$10$KEW46fHm98DZ9Ap3LFuRVuadOkXDE3CFhKurwsRh3kb9hw6uuqLAG";

  it("verifies a hash created by bcrypt 5 and rejects a wrong password", async () => {
    expect(await bcrypt.compare("Legacy-Passw0rd!", LEGACY_V5_HASH)).toBe(true);
    expect(await bcrypt.compare("Legacy-Passw0rd?", LEGACY_V5_HASH)).toBe(false);
  });

  it("round-trips a new hash ($2b$ prefix, cost preserved)", async () => {
    const hash = await bcrypt.hash("Fresh-Passw0rd!", 10);
    expect(hash).toMatch(/^\$2b\$10\$.{53}$/);
    expect(await bcrypt.compare("Fresh-Passw0rd!", hash)).toBe(true);
    expect(await bcrypt.compare("other", hash)).toBe(false);
    expect(await bcrypt.compare("x", "not-a-hash")).toBe(false);
  });

  it("LocalCredentialProvider (cost 12) creates, verifies and rejects", async () => {
    const provider = new LocalCredentialProvider();
    const { passwordHash } = await provider.createCredential("a@example.test", "Provider-Passw0rd!");
    expect(passwordHash).toMatch(/^\$2b\$12\$/);
    await expect(provider.verifyCredential("a@example.test", "Provider-Passw0rd!", passwordHash)).resolves.toBeUndefined();
    await expect(provider.verifyCredential("a@example.test", "wrong", passwordHash)).rejects.toThrow("Invalid credentials");
    await expect(provider.verifyCredential("a@example.test", "x", null)).rejects.toThrow("Invalid credentials");
    // A hash made by bcrypt 5 at cost 10 still verifies through the provider.
    await expect(provider.verifyCredential("a@example.test", "Legacy-Passw0rd!", LEGACY_V5_HASH)).resolves.toBeUndefined();
  });
});
