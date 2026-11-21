import { Injectable, NotFoundException } from "@nestjs/common";
import { MemberProfileView, PROFILE_PRIVACY_FIELDS, memberVisibleRelationship } from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import { applyFieldPolicy, viewerFrom } from "../../../../common/field-policy";
import { ProfilePrivacyService } from "./profile-privacy.service";

// Another member's profile as the viewer may see it (TASK-025). The full record is assembled and
// then passed through the field-protection policy: the owner, staff, and viewers holding a
// "member-visible:<field>" relationship (granted only for fields the owner opened) keep the
// field, everyone else gets it stripped. Name and avatar are what content already shows next to
// posts, so they are always present. Email and WhatsApp number are never part of this view.
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privacy: ProfilePrivacyService,
  ) {}

  async profile(viewer: { sub: string; roles?: readonly string[] }, userId: string): Promise<MemberProfileView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { socialLinks: true, certifications: { orderBy: { issueDate: "desc" } } },
    });
    // Unapproved accounts are not part of the community yet; the same 404 as a missing id.
    if (!user || (!user.isApproved && viewer.sub !== userId)) throw new NotFoundException("Member not found");

    const settings = await this.privacy.settingsFor(userId);
    const full = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      professionalExperience: user.professionalExperience,
      socialLinks: user.socialLinks
        ? { linkedin: user.socialLinks.linkedin, github: user.socialLinks.github, twitter: user.socialLinks.twitter, website: user.socialLinks.website }
        : null,
      certifications: user.certifications.map((c) => ({
        name: c.name,
        issueDate: c.issueDate?.toISOString() ?? null,
        expiryDate: c.expiryDate?.toISOString() ?? null,
        verificationUrl: c.verificationUrl,
      })),
    };

    return applyFieldPolicy(full, viewerFrom(viewer), {
      // Only the profile object itself (matched by id) carries the owner's choices.
      relationshipsOf: (obj) =>
        obj.id === userId ? PROFILE_PRIVACY_FIELDS.filter((f) => settings[f] === "members").map(memberVisibleRelationship) : [],
    }) as MemberProfileView;
  }
}
