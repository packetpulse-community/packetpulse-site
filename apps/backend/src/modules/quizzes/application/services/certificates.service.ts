import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId, revokedAt: null },
      include: { quiz: { select: { id: true, title: true, category: true } } },
      orderBy: { issuedAt: "desc" },
    });
  }

  // Public, unauthenticated: show only what a verifier needs (holder name, quiz title,
  // number, issue date). No user id, attempt id, file URL or revocation detail (TASK-012).
  async verify(certificateNumber: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { certificateNumber },
      select: {
        certificateNumber: true,
        issuedAt: true,
        revokedAt: true,
        quiz: { select: { title: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!certificate || certificate.revokedAt) throw new NotFoundException("Certificate not found");
    const { revokedAt: _revokedAt, ...visible } = certificate;
    return visible;
  }
}
