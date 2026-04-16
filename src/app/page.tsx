import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          JaylaOps
        </h1>
        <p className="mt-4 text-xl text-gray-500">
          Hospitality operations platform for Jayla Selfcatering
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
