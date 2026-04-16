"use client";

import { login } from "@/app/actions/auth";
import Link from "next/link";
import { useState } from "react";
import { LoginIllustration } from "@/app/components/illustrations";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — illustration (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden">
        <LoginIllustration className="absolute inset-0 w-full h-full object-cover" />
        <div className="relative z-10 text-center px-12">
          <h2 className="text-3xl font-bold text-white drop-shadow-lg">
            Welcome back
          </h2>
          <p className="mt-2 text-brand-100 text-sm drop-shadow">
            Your property, your team, all in one place.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-brand-50 px-6">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-center text-3xl font-bold text-brand-900">
            JaylaOps
          </h1>
          <p className="mb-8 text-center text-brand-600 text-sm">
            Sign in to your account
          </p>

          <form action={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-brand-800"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-brand-800"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Your password"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link
              href="/forgot-password"
              className="font-medium text-brand-600 hover:text-brand-800"
            >
              Forgot your password?
            </Link>
          </p>

          <p className="mt-4 text-center text-sm text-brand-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-brand-800 hover:text-brand-900"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
