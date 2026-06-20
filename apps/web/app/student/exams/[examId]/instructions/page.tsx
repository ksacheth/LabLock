"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";

import {
  buildStudentExamRoomPath,
  markExamEntryConsent,
} from "../../entry-access";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REQUIRED_ROLE = "STUDENT";

function getDashboardPathForRole(role: string) {
  if (role === "STUDENT") return "/student/dashboard";
  if (role === "FACULTY") return "/teacher/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/auth";
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Attempt {
  id: string;
  status: string;
  score: number | null;
  startedAt: string;
  completedAt: string | null;
  retakeNumber: number;
}

interface Exam {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  durationMin: number;
  _count: { questions: number };
  attempts?: Attempt[];
}

function getLatestAttempt(exam: Exam) {
  return exam.attempts?.[0] ?? null;
}

function isExamLive(exam: Exam, nowMs: number) {
  return (
    exam.isActive &&
    new Date(exam.startTime).getTime() <= nowMs &&
    new Date(exam.endTime).getTime() > nowMs
  );
}

export default function StudentExamInstructionsPage() {
  const params = useParams<Record<string, string | string[]>>();
  const router = useRouter();
  const examIdParam = params.examId;
  const examId = Array.isArray(examIdParam) ? examIdParam[0] : examIdParam;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  useEffect(() => {
    if (!examId) {
      setError("Exam instructions are unavailable.");
      setLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      router.replace("/auth/student/login");
      return;
    }

    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored) as User;
        if (parsedUser.role !== REQUIRED_ROLE) {
          router.replace(getDashboardPathForRole(parsedUser.role));
          return;
        }
      } catch {
        localStorage.removeItem("user");
      }
    }

    let isActive = true;

    async function loadExam() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [meRes, examsRes] = await Promise.all([
          axios.get<User>(`${API_URL}/api/me`, { headers }),
          axios.get<Exam[]>(`${API_URL}/api/getExams`, { headers }),
        ]);

        if (!isActive) return;

        if (meRes.data.role !== REQUIRED_ROLE) {
          router.replace(getDashboardPathForRole(meRes.data.role));
          return;
        }

        const matchedExam = examsRes.data.find(
          (candidate) => candidate.id === examId,
        );
        if (!matchedExam) {
          setError("This exam is not available for your account.");
          return;
        }

        setExam(matchedExam);
      } catch (err) {
        if (!isActive) return;
        if (err instanceof AxiosError) {
          setError(
            err.response?.data?.error ?? "Failed to load exam instructions.",
          );
        } else {
          setError("Failed to load exam instructions.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadExam();

    return () => {
      isActive = false;
    };
  }, [examId, router]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const latestAttempt = exam ? getLatestAttempt(exam) : null;
  const isLocked =
    latestAttempt?.status === "COMPLETED" ||
    latestAttempt?.status === "DISQUALIFIED";
  const liveNow = exam ? isExamLive(exam, currentTimeMs) : false;
  const canEnter = Boolean(exam) && liveNow && !isLocked;

  const handleEnter = () => {
    if (!examId || !canEnter) return;
    markExamEntryConsent(examId);
    router.push(buildStudentExamRoomPath(examId));
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_100%)] text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-10 md:px-10">
        {loading ? (
          <div className="flex justify-center py-24">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">
              progress_activity
            </span>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <span className="material-symbols-outlined text-4xl text-red-500">
              error
            </span>
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
              Unable to load instructions
            </h1>
            <p className="mt-3 text-sm text-slate-600">{error}</p>
            <button
              onClick={() => router.push("/student/dashboard")}
              className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              Return to dashboard
            </button>
          </div>
        ) : exam ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_340px]">
            <section className="overflow-hidden rounded-[32px] border border-primary/10 bg-white shadow-xl shadow-slate-200/70">
              <div className="border-b border-primary/10 bg-[linear-gradient(135deg,_rgba(14,165,233,0.12),_rgba(16,185,129,0.10))] px-8 py-8">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-primary/70">
                  Exam Entry
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-primary">
                  {exam.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  {exam.description ??
                    "Read these instructions completely before starting. Enter the room only when you are ready to stay focused for the full duration."}
                </p>
              </div>


            </section>

            <aside className="space-y-6">
              <section className="rounded-[28px] border border-primary/10 bg-slate-950 p-6 text-white shadow-lg shadow-slate-300/40">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-white/60">
                  Exam Snapshot
                </p>
                <div className="mt-5 space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                    <span className="text-white/70">Duration</span>
                    <span className="font-bold">
                      {exam.durationMin} minutes
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                    <span className="text-white/70">Questions</span>
                    <span className="font-bold">
                      {exam._count.questions} total
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                    <span className="text-white/70">Starts</span>
                    <span className="text-right font-bold">
                      {formatDateTime(exam.startTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-white/70">Ends</span>
                    <span className="text-right font-bold">
                      {formatDateTime(exam.endTime)}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-primary/10 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Access Status
                </p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p>
                    {isLocked
                      ? `Entry is blocked because your latest attempt is ${latestAttempt?.status?.toLowerCase()}.`
                      : liveNow
                        ? "The exam is live. You can continue when you are ready."
                        : "This exam is not live right now."}
                  </p>
                  {latestAttempt ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      Latest attempt status:{" "}
                      <span className="font-bold text-slate-900">
                        {latestAttempt.status}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={handleEnter}
                    disabled={!canEnter}
                    className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {latestAttempt?.status === "IN_PROGRESS"
                      ? "Resume Exam Room"
                      : "Enter Exam Room"}
                  </button>
                  <button
                    onClick={() => router.push("/student/dashboard")}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
                  >
                    Return to dashboard
                  </button>
                </div>
              </section>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}
