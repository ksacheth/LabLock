"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
import PublicHeader from "../../../components/PublicHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Batch {
  id: string;
  label: string;
  yearOfStudy: number;
  intakeYear: number;
  departmentId: string;
}

export default function StudentSignup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // Fetch departments on mount
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const res = await axios.get<Department[]>(`${API_URL}/api/departments`);
        setDepartments(res.data);
      } catch {
        console.error("Failed to load departments");
      } finally {
        setLoadingDepts(false);
      }
    }
    fetchDepartments();
  }, []);

  // Fetch batches when department changes
  useEffect(() => {
    if (!departmentId) {
      setBatches([]);
      setBatchId("");
      return;
    }

    async function fetchBatches() {
      try {
        const res = await axios.get<Batch[]>(
          `${API_URL}/api/batches?departmentId=${departmentId}`
        );
        setBatches(res.data);
      } catch {
        console.error("Failed to load batches");
      }
    }
    fetchBatches();
    setBatchId(""); // Reset batch when department changes
  }, [departmentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: Record<string, string> = { name, email, password };
      if (departmentId) payload.departmentId = departmentId;
      if (batchId) payload.batchId = batchId;
      if (rollNumber.trim()) payload.rollNumber = rollNumber.trim();

      await axios.post(`${API_URL}/api/signup`, payload);
      router.push("/auth/student/login?registered=1");
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

  const inputClasses =
    "w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";

  const selectClasses =
    "w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors appearance-none";

  const labelClasses =
    "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5";

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex flex-1 justify-center items-center py-12 px-6">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-primary/10 shadow-sm p-8">
            {/* Icon + Title */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-full bg-light-blue/20 text-primary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl">
                  person_add
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                Create Student Account
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Join NITK Lab Proctor as a student
              </p>
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
              {/* Full Name */}
              <div>
                <label htmlFor="name" className={labelClasses}>
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
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClasses}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className={labelClasses}>
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
                    className={inputClasses}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Must be an official NITK email ending in @nitk.edu.in
                </p>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className={labelClasses}>
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

              {/* ── Academic Details Divider ── */}
              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center pt-2">
                  <div className="w-full border-t border-slate-200 dark:border-slate-600" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-slate-800 px-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Academic Details
                  </span>
                </div>
              </div>

              {/* Department */}
              <div>
                <label htmlFor="department" className={labelClasses}>
                  Department
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                    domain
                  </span>
                  <select
                    id="department"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    disabled={loadingDepts}
                    className={selectClasses}
                  >
                    <option value="">
                      {loadingDepts
                        ? "Loading departments..."
                        : "Select your department"}
                    </option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Batch — only shown when a department is selected */}
              {departmentId && (
                <div>
                  <label htmlFor="batch" className={labelClasses}>
                    Batch
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      groups_2
                    </span>
                    <select
                      id="batch"
                      value={batchId}
                      onChange={(e) => setBatchId(e.target.value)}
                      className={selectClasses}
                    >
                      <option value="">Select your batch</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label} (Year {b.yearOfStudy}, Intake{" "}
                          {b.intakeYear})
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      expand_more
                    </span>
                  </div>
                  {batches.length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-500">
                      No batches available for this department yet.
                    </p>
                  )}
                </div>
              )}

              {/* Roll Number */}
              <div>
                <label htmlFor="rollNumber" className={labelClasses}>
                  Roll Number
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                    tag
                  </span>
                  <input
                    id="rollNumber"
                    type="text"
                    maxLength={20}
                    placeholder="e.g. 22CS001"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className={inputClasses}
                  />
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
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{" "}
              <Link
                href="/auth/student/login"
                className="text-primary font-semibold hover:underline"
              >
                Student Login
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
