import { MarketingBackground } from "@/features/landing/components/MarketingBackground";
import { Navbar } from "@/features/landing/components/Navbar";
import { quizzesServerApi } from "@/features/quizzes/api/quizzes.api";
import { ApiError } from "@/shared/api/http-client";

export default async function VerifyCertificatePage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;

  let certificate = null;
  try {
    certificate = await quizzesServerApi.verifyCertificate(number);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err;
  }

  return (
    <MarketingBackground>
      <Navbar />
      <main className="container flex flex-col items-center gap-6 py-20 text-center">
        {certificate ? (
          <div className="glass-panel flex flex-col gap-3 rounded-lg p-8">
            <h1 className="text-2xl font-semibold text-green-400">✅ Certificate Verified</h1>
            <p className="text-lg">{certificate.quiz.title}</p>
            <p className="text-muted-foreground">
              Issued to {certificate.user.firstName} {certificate.user.lastName}
            </p>
            <p className="text-sm text-muted-foreground">
              Certificate {certificate.certificateNumber} · {new Date(certificate.issuedAt).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <div className="glass-panel flex flex-col gap-3 rounded-lg p-8">
            <h1 className="text-2xl font-semibold text-destructive">Certificate Not Found</h1>
            <p className="text-muted-foreground">No certificate matches &ldquo;{number}&rdquo;.</p>
          </div>
        )}
      </main>
    </MarketingBackground>
  );
}
