import { UserWithRoles } from "../entities/user.entity";

// Abstract class used as a DI token — identity is a pilot module for the repository
// pattern (plan §3); other modules call PrismaService directly until their query
// complexity earns this indirection.
export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<UserWithRoles | null>;
  abstract findById(id: string): Promise<UserWithRoles | null>;
  abstract create(data: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    whatsappNumber?: string;
    roleNames: string[];
    isApproved: boolean;
    emailVerified: boolean;
  }): Promise<UserWithRoles>;
  abstract updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  abstract markEmailVerified(userId: string): Promise<void>;
  abstract markLastLogin(userId: string): Promise<void>;
  abstract setApproval(userId: string, approved: boolean, approvedById: string | null): Promise<void>;
}
