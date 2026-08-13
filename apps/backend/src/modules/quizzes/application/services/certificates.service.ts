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

  async verify(certificateNumber: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { certificateNumber },
      include: {
        quiz: { select: { id: true, title: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!certificate || certificate.revokedAt) throw new NotFoundException("Certificate not found");
    return certificate;
  }
}
