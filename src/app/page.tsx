import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HeroIllustration } from "@/app/components/illustrations";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If already logged in, go straight to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left — branding + CTA */}
      <div className="flex flex-1 flex-col items-center justify-center bg-brand-50 px-8 py-16 lg:items-start lg:px-16">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
            JaylaOps
          </h1>
          <p className="mt-3 text-lg text-brand-700">
            Hospitality operations platform for Jayla Selfcatering
          </p>
          <p className="mt-4 text-sm text-brand-600 leading-relaxed">
            Manage daily housekeeping tasks, track maintenance issues, collect
            guest feedback, and keep your property running smoothly — all in
            one place.
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              href="/login"
              className="rounded-lg bg-brand-800 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg border border-brand-300 bg-white px-6 py-2.5 text-sm font-medium text-brand-800 shadow-sm hover:bg-brand-100 transition-colors"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>

      {/* Right — illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300 p-12">
        <HeroIllustration className="w-full max-w-lg drop-shadow-lg" />
      </div>

      {/* Mobile illustration (below CTA) */}
      <div className="flex lg:hidden items-center justify-center bg-gradient-to-b from-brand-100 to-brand-200 px-8 pb-12">
        <HeroIllustration className="w-full max-w-sm" />
      </div>
    </div>
  );
}
