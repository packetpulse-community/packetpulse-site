import { getCurrentUser } from "@/shared/auth/session";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { MarketingBackground } from "@/features/landing/components/MarketingBackground";
import { Navbar } from "@/features/landing/components/Navbar";
import { Footer } from "@/features/landing/components/Footer";

// Public — no auth redirect. The backend already serves blogs publicly
// (@Public() on GET /blogs*); getCurrentUser() resolves to null for anonymous
// visitors instead of redirecting, so useAuth() still works correctly in child
// client components (LikeButton/CommentSection prompt login instead of 401ing).
export default async function BlogsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <AuthProvider user={user}>
      <MarketingBackground>
        <Navbar />
        <main className="mx-auto w-full max-w-6xl px-4 py-12">{children}</main>
        <Footer />
      </MarketingBackground>
    </AuthProvider>
  );
}
