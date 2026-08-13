import { cookies } from "next/headers";
import { quizzesServerApi } from "@/features/quizzes/api/quizzes.api";

export default async function CertificatesPage() {
  const cookieHeader = (await cookies()).toString();
  const certificates = await quizzesServerApi.myCertificates(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">My Certificates</h1>
      <div className="flex flex-col gap-3">
        {certificates.map((cert) => (
          <div key={cert.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <p className="font-medium">{cert.quiz.title}</p>
              <p className="text-sm text-muted-foreground">
                {cert.certificateNumber} · issued {new Date(cert.issuedAt).toLocaleDateString()}
              </p>
            </div>
            <span className="rounded bg-accent px-2 py-1 text-xs text-accent-foreground">{cert.quiz.category}</span>
          </div>
        ))}
        {certificates.length === 0 && <p className="text-muted-foreground">No certificates yet — pass a quiz to earn one.</p>}
      </div>
    </div>
  );
}
