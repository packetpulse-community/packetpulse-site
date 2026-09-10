import { ProfessionalExperience } from "@prisma/client";
import { UserWithRoles } from "../entities/user.entity";

// Abstract class used as a DI token — identity is a pilot module for the repository
// pattern (plan §3); other modules call PrismaService directly until their query
// complexity earns this indirection.
export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<UserWithRoles | null>;
  abstract findById(id: string): Promise<UserWithRoles | null>;
  abstract create(data: {
    // Set only in PLATFORM_MODE=supabase, where Supabase Auth mints the id first
    // (CredentialProvider.createCredential) so it can double as the RBAC/approval FK.
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    // Absent in PLATFORM_MODE=supabase — the credential lives in Supabase Auth, not here.
    passwordHash?: string;
    whatsappNumber?: string;
    professionalExperience?: ProfessionalExperience;
    roleNames: string[];
    isApproved: boolean;
    emailVerified: boolean;
  }): Promise<UserWithRoles>;
  abstract updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  abstract markEmailVerified(userId: string): Promise<void>;
  abstract markLastLogin(userId: string): Promise<void>;
  abstract setApproval(userId: string, approved: boolean, approvedById: string | null): Promise<void>;
}
