import { cookies } from "next/headers";
import { quizzesServerApi } from "@/features/quizzes/api/quizzes.api";
import { Card } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { CopyVerifyLinkButton } from "@/features/quizzes/components/CopyVerifyLinkButton";

export default async function CertificatesPage() {
  const cookieHeader = (await cookies()).toString();
  const certificates = await quizzesServerApi.myCertificates(cookieHeader);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold">My Certificates</h1>
        <p className="text-muted-foreground">Certificates you've earned by passing quizzes.</p>
      </div>
      <div className="flex flex-col gap-3">
        {certificates.map((cert) => (
          <Card key={cert.id} variant="glass" className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{cert.quiz.title}</p>
              <p className="text-sm text-muted-foreground">
                {cert.certificateNumber} · issued {new Date(cert.issuedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="glass">{cert.quiz.category}</Badge>
              <CopyVerifyLinkButton certificateNumber={cert.certificateNumber} />
            </div>
          </Card>
        ))}
        {certificates.length === 0 && <p className="text-muted-foreground">No certificates yet — pass a quiz to earn one.</p>}
      </div>
    </div>
  );
}
