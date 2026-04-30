"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
import TeacherNavbar from "../../components/TeacherNavbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REQUIRED_ROLE = "FACULTY";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function getDashboardPathForRole(role: string) {
  if (role === "STUDENT") return "/student/dashboard";
  if (role === "FACULTY") return "/teacher/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/auth";
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ExamOption {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface ResultsPayload {
  exam: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    totalMarks: number;
  };
  summary: {
    participantCount: number;
    averageScore: number | null;
    highestScore: number | null;
  };
  attempts: Array<{
    rank: number;
    attemptId: string;
    userId: string;
    name: string;
    rollNumber: string | null;
    email: string;
    score: number | null;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
  }>;
}

function formatDurationMs(ms: number | null) {
  if (ms === null || Number.isNaN(ms)) return "—";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TeacherResultsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const loadExams = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/auth/teacher/login");
      return;
    }

    try {
      const meRes = await axios.get<User>(`${API_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.data.role !== REQUIRED_ROLE) {
        router.replace(getDashboardPathForRole(meRes.data.role));
        return;
      }

      const examsRes = await axios.get<ExamOption[]>(`${API_URL}/api/getExams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExams(examsRes.data);
      if (examsRes.data.length > 0) {
        setSelectedExamId((prev) => prev || examsRes.data[0]!.id);
      }
    } catch {
      setError("Failed to load exams.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  useEffect(() => {
    const token = getToken();
    if (!token || !selectedExamId) {
      setResults(null);
      return;
    }

    let cancelled = false;
    setResultsLoading(true);

    (async () => {
      try {
        const { data } = await axios.get<ResultsPayload>(
          `${API_URL}/api/faculty/exams/${selectedExamId}/results`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!cancelled) setResults(data);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof AxiosError
              ? (err.response?.data as { error?: string })?.error ??
                "Failed to load results."
              : "Failed to load results.";
          setError(msg);
          setResults(null);
        }
      } finally {
        if (!cancelled) setResultsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedExamId]);

  const exportCsv = () => {
    if (!results) return;
    const rows = [
      ["Rank", "Name", "Roll", "Email", "Score", "Completed", "Duration"].join(
        ",",
      ),
      ...results.attempts.map((a) =>
        [
          a.rank,
          `"${(a.name ?? "").replace(/"/g, '""')}"`,
          a.rollNumber ?? "",
          a.email ?? "",
          a.score ?? "",
          a.completedAt ?? "",
          a.durationMs ?? "",
        ].join(","),
      ),
    ];
    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results-${results.exam.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedExamTitle =
    exams.find((e) => e.id === selectedExamId)?.title ?? "Exam";

  return (
    <div className="min-h-screen bg-background-light text-slate-900">
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
        <TeacherNavbar activePage="reports" />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <a
              className="hover:text-primary flex items-center gap-1"
              href="/teacher/dashboard"
            >
              <span className="material-symbols-outlined text-base">home</span>
              Dashboard
            </a>
            <span className="material-symbols-outlined text-xs">
              chevron_right
            </span>
            <span className="font-semibold text-primary">Results</span>
          </nav>

          <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                Exam results
              </h1>
              <p className="mt-1 flex items-center gap-2 text-slate-500">
                <span className="material-symbols-outlined text-sm">school</span>
                Leaderboard and scores from submitted attempts
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                Exam
                <select
                  value={selectedExamId}
                  onChange={(e) => {
                    setError("");
                    setSelectedExamId(e.target.value);
                  }}
                  className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {exams.length === 0 ? (
                    <option value="">No exams</option>
                  ) : (
                    exams.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button
                type="button"
                onClick={exportCsv}
                disabled={!results?.attempts.length}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg">
                  download
                </span>
                Export CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                progress_activity
              </span>
            </div>
          ) : error && !results ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          {resultsLoading && selectedExamId ? (
            <p className="mb-4 text-sm font-medium text-slate-500">
              Loading results for {selectedExamTitle}…
            </p>
          ) : null}

          {results ? (
            <>
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">
                    Total marks
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {results.exam.totalMarks}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">
                    Submissions
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {results.summary.participantCount}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">
                    Average score
                  </p>
                  <p className="mt-1 text-2xl font-black text-primary">
                    {results.summary.averageScore ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">
                    Highest score
                  </p>
                  <p className="mt-1 text-2xl font-black text-emerald-600">
                    {results.summary.highestScore ?? "—"}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-6 py-4">Rank</th>
                        <th className="px-6 py-4">Student</th>
                        <th className="px-6 py-4 text-center">Score</th>
                        <th className="px-6 py-4">Completed</th>
                        <th className="px-6 py-4">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {results.attempts.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-slate-500"
                          >
                            No submitted attempts yet. Students must use
                            &quot;Submit exam&quot; after finishing.
                          </td>
                        </tr>
                      ) : (
                        results.attempts.map((a) => (
                          <tr
                            key={a.attemptId}
                            className="hover:bg-primary/5 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                                {a.rank}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900">
                                {a.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {a.rollNumber ?? "—"} · {a.email}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-bold text-primary">
                                {a.score ?? "—"}
                              </span>
                              <span className="text-slate-400">
                                {" "}
                                / {results.exam.totalMarks}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {formatWhen(a.completedAt)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {formatDurationMs(a.durationMs)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </main>

        <footer className="mt-auto border-t border-primary/10 bg-white px-8 py-6 text-center text-sm text-slate-500 md:text-left">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
            <p>LabLock — Faculty results</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
