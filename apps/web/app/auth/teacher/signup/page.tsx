"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
import PublicHeader from "../../../components/PublicHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function TeacherSignup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await axios.post(`${API_URL}/api/signup`, { name, email, password });
      router.push("/auth/teacher/login?registered=1");
    } catch (err) {
      const axiosErr = err as AxiosError<{
        error?: string;
        errors?: Record<string, string[]>;
      }>;
      const data = axiosErr.response?.data;
      if (data?.errors) {
        const messages = Object.values(data.errors).flat().join(" ");
        setError(messages);
      } else {
        setError(data?.error ?? "Sign up failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex flex-1 justify-center items-center py-12 px-6">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-primary/10 shadow-sm p-8">
            {/* Icon + Title */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-full bg-accent-blue/20 text-primary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl">
                  edit_note
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                Register as Educator
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Apply to join NITK Lab Proctor as faculty
              </p>
            </div>

            {/* Info Banner */}
            <div className="mb-6 flex items-start gap-3 bg-accent-blue/10 border border-accent-blue/30 text-primary dark:text-accent rounded-lg px-4 py-3 text-sm">
              <span className="material-symbols-outlined text-base mt-0.5 shrink-0">
                info
              </span>
              <span>
                Faculty accounts require admin approval before activation. You
                will be notified via email once approved.
              </span>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
                <span className="material-symbols-outlined text-base mt-0.5 shrink-0">
                  error
                </span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                    badge
                  </span>
                  <input
                    id="name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Prof. Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  NITK Email
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                    mail
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@nitk.edu.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Must be an official NITK email ending in @nitk.edu.in
                </p>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                    lock
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 h-12 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-xl animate-spin">
                      progress_activity
                    </span>
                    Submitting...
                  </>
                ) : (
                  "Submit Registration"
                )}
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{" "}
              <Link
                href="/auth/teacher/login"
                className="text-primary font-semibold hover:underline"
              >
                Teacher Login
              </Link>
            </div>
            <div className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
              <Link
                href="/auth"
                className="flex items-center justify-center gap-1 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-base">
                  arrow_back
                </span>
                Back to role selection
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
