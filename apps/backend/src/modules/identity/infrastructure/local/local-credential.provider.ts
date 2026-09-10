import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { CredentialProvider } from "../../domain/providers/credential-provider";

const BCRYPT_COST = 12;

@Injectable()
export class LocalCredentialProvider extends CredentialProvider {
  async createCredential(email: string, password: string) {
    return { passwordHash: await bcrypt.hash(password, BCRYPT_COST) };
  }

  async verifyCredential(email: string, password: string, storedPasswordHash: string | null) {
    const matches = storedPasswordHash ? await bcrypt.compare(password, storedPasswordHash) : false;
    if (!matches) throw new UnauthorizedException("Invalid credentials");
  }

  async updateCredential(userId: string, email: string, newPassword: string) {
    return { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) };
  }
}
