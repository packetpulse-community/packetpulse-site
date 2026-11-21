import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ONBOARDING_ITEM_LABELS,
  ONBOARDING_ITEMS,
  type OnboardingItem,
  type OnboardingStatus,
  type OnboardingStep,
} from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import type { SaveOnboardingDto } from "../dto/onboarding.dto";

// TASK-023 / PRD-003 / API-006 / TEST-003. The required details are saved step by step, so the
// flow can be left and resumed; what is still missing is always computed from what is stored,
// never from a client-side step counter. Skills are saved through the existing skill picker
// (PUT /skills/mine) and only counted here. WhatsApp (PRD-006) is the one optional item.
const STEP_OF: Record<OnboardingItem, OnboardingStep> = {
  professionalExperience: "about",
  dateOfBirth: "about",
  targetRole: "goals",
  careerGoals: "goals",
  skills: "skills",
};

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async status(userId: string): Promise<OnboardingStatus> {
    const [user, skillCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          professionalExperience: true,
          dateOfBirth: true,
          targetRole: true,
          careerGoals: true,
          whatsappNumber: true,
          onboardingCompletedAt: true,
        },
      }),
      this.prisma.memberSkill.count({ where: { userId, skill: { status: "active" } } }),
    ]);
    if (!user) throw new NotFoundException("Account not found");

    const present: Record<OnboardingItem, boolean> = {
      professionalExperience: user.professionalExperience !== null,
      dateOfBirth: user.dateOfBirth !== null,
      targetRole: !!user.targetRole,
      careerGoals: !!user.careerGoals,
      skills: skillCount > 0,
    };
    const missing = ONBOARDING_ITEMS.filter((item) => !present[item]);
    const next: OnboardingStep | null = user.onboardingCompletedAt ? null : missing.length > 0 ? STEP_OF[missing[0]!] : "contact";
    return {
      complete: user.onboardingCompletedAt !== null,
      completedAt: user.onboardingCompletedAt?.toISOString() ?? null,
      missing,
      nextStep: next,
      values: {
        professionalExperience: user.professionalExperience,
        // The member's own record only; the field policy keeps it from everyone else (SEC-02).
        dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
        targetRole: user.targetRole,
        careerGoals: user.careerGoals,
        whatsappNumber: user.whatsappNumber,
        skillCount,
      },
    };
  }

  /** Saves any subset of the details. A blank WhatsApp number clears it. Does not mark the flow complete. */
  async save(userId: string, dto: SaveOnboardingDto): Promise<OnboardingStatus> {
    const data: Record<string, unknown> = {};
    if (dto.professionalExperience !== undefined) data.professionalExperience = dto.professionalExperience;
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = new Date(`${dto.dateOfBirth}T00:00:00Z`);
    if (dto.targetRole !== undefined) data.targetRole = dto.targetRole;
    if (dto.careerGoals !== undefined) data.careerGoals = dto.careerGoals;
    // `whatsappNumber` arrives already normalised to E.164, or undefined when blank. The key being
    // present in the body (even as "") means "set or clear"; an absent key leaves it alone.
    if ("whatsappNumber" in (dto as object)) data.whatsappNumber = dto.whatsappNumber ?? null;
    if (Object.keys(data).length > 0) await this.prisma.user.update({ where: { id: userId }, data });
    return this.status(userId);
  }

  /** Marks the flow done when nothing required is missing; otherwise lists what is missing (TEST-003). */
  async complete(userId: string): Promise<OnboardingStatus> {
    const current = await this.status(userId);
    if (current.complete) return current;
    if (current.missing.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Please finish: ${current.missing.map((m) => ONBOARDING_ITEM_LABELS[m]).join(", ")}.`,
        missing: current.missing,
      });
    }
    await this.prisma.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } });
    return this.status(userId);
  }
}
