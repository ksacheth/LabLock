"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REQUIRED_ROLE = "FACULTY";

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
  department?: Department;
}
interface ExamEligibility {
  id: string;
  batchId: string | null;
  batch?: Batch | null;
}
interface Exam {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  durationMin: number;
  createdAt: string;
  eligibilities?: ExamEligibility[];
  _count?: { questions: number; attempts: number };
}

interface TeacherDashboardData {
  me: User;
  exams: Exam[];
  departments: Department[];
  batches: Batch[];
}

function formatBatchLabel(
  batch: Pick<Batch, "label" | "yearOfStudy" | "intakeYear">,
  departmentCode?: string,
) {
  const baseLabel = `${batch.label} • Year ${batch.yearOfStudy} • Intake ${batch.intakeYear}`;
  return departmentCode ? `${baseLabel} • ${departmentCode}` : baseLabel;
}

function calculateEndTime(startTime: string, durationMin: number) {
  if (!startTime || !Number.isFinite(durationMin) || durationMin <= 0) {
    return null;
  }

  const parsedStartTime = new Date(startTime);
  if (Number.isNaN(parsedStartTime.getTime())) {
    return null;
  }

  return new Date(parsedStartTime.getTime() + durationMin * 60_000);
}

function formatDateTimePreview(date: Date) {
  return date.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExamDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isExamLive(
  exam: Pick<Exam, "isActive" | "startTime" | "endTime">,
  nowMs: number,
) {
  return (
    exam.isActive &&
    new Date(exam.startTime).getTime() <= nowMs &&
    new Date(exam.endTime).getTime() > nowMs
  );
}

async function fetchTeacherDashboardData(
  token: string,
): Promise<TeacherDashboardData> {
  const headers = { Authorization: `Bearer ${token}` };
  const [meRes, examsRes, departmentsRes, batchesRes] = await Promise.all([
    axios.get<User>(`${API_URL}/api/me`, { headers }),
    axios.get<Exam[]>(`${API_URL}/api/getExams`, { headers }),
    axios.get<Department[]>(`${API_URL}/api/departments`),
    axios.get<Batch[]>(`${API_URL}/api/batches`),
  ]);

  return {
    me: meRes.data,
    exams: examsRes.data,
    departments: departmentsRes.data,
    batches: batchesRes.data,
  };
}

export default function TeacherDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [examActionNotice, setExamActionNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [activeActionExamId, setActiveActionExamId] = useState<string | null>(
    null,
  );
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [batchId, setBatchId] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const applyDashboardData = (data: TeacherDashboardData) => {
    setUser(data.me);
    setExams(data.exams);
    setDepartments(data.departments);
    setBatches(data.batches);
  };

  const refreshDashboardData = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/auth/teacher/login");
      return false;
    }

    const data = await fetchTeacherDashboardData(token);
    if (data.me.role !== REQUIRED_ROLE) {
      router.replace(getDashboardPathForRole(data.me.role));
      return false;
    }

    applyDashboardData(data);
    return true;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/auth/teacher/login");
      return;
    }
    const authToken = token;

    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored) as User;
        if (parsedUser.role !== REQUIRED_ROLE) {
          router.replace(getDashboardPathForRole(parsedUser.role));
          return;
        }
        setUser(parsedUser);
      } catch {
        localStorage.removeItem("user");
      }
    }

    let isActive = true;

    async function fetchData() {
      try {
        const data = await fetchTeacherDashboardData(authToken);
        if (!isActive) return;
        if (data.me.role !== REQUIRED_ROLE) {
          router.replace(getDashboardPathForRole(data.me.role));
          return;
        }
        applyDashboardData(data);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
        if (isActive) {
          setError("Failed to load dashboard data.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }
    fetchData();

    return () => {
      isActive = false;
    };
  }, [router]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!batchId) {
      setCreateError("Select which batch this exam is for.");
      return;
    }

    const parsedStartTime = new Date(startTime);
    if (Number.isNaN(parsedStartTime.getTime())) {
      setCreateError("Choose a valid start time.");
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API_URL}/api/createExam`,
        {
          title,
          description,
          startTime: parsedStartTime.toISOString(),
          durationMin: Number(durationMin),
          batchId,
          isActive: false,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      router.push(`/teacher/exams?examId=${data.id}`);
    } catch (err) {
      const axiosErr = err as AxiosError<{
        error?: string;
        errors?: Record<string, string[]>;
      }>;
      const d = axiosErr.response?.data;
      if (d?.errors) setCreateError(Object.values(d.errors).flat().join(" "));
      else
        setCreateError(d?.error ?? "Failed to create exam. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleGoLive = async (examId: string) => {
    setActiveActionExamId(examId);
    try {
      setExamActionNotice(null);
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_URL}/api/exams/${examId}`,
        { isActive: true },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const refreshed = await refreshDashboardData();
      if (refreshed) {
        setExamActionNotice({
          type: "success",
          message: "Exam started and verified in active sessions.",
        });
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setExamActionNotice({
          type: "error",
          message: err.response?.data?.error ?? "Failed to make the exam live.",
        });
      } else {
        setExamActionNotice({
          type: "error",
          message: "Failed to make the exam live.",
        });
      }
    } finally {
      setActiveActionExamId(null);
    }
  };

  const handleForceStopExam = async (exam: Exam) => {
    const shouldStop = window.confirm(
      `Force stop "${exam.title}" right now? Students will lose access immediately.`,
    );
    if (!shouldStop) return;

    setActiveActionExamId(exam.id);
    try {
      setExamActionNotice(null);
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_URL}/api/exams/${exam.id}`,
        { isActive: false },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const refreshed = await refreshDashboardData();
      if (refreshed) {
        setExamActionNotice({
          type: "success",
          message: "Exam stopped and removed from active sessions.",
        });
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setExamActionNotice({
          type: "error",
          message: err.response?.data?.error ?? "Failed to stop the exam.",
        });
      } else {
        setExamActionNotice({
          type: "error",
          message: "Failed to stop the exam.",
        });
      }
    } finally {
      setActiveActionExamId(null);
    }
  };

  const handleDeleteDraft = async (exam: Exam) => {
    const shouldDelete = window.confirm(
      `Delete draft "${exam.title}"? This cannot be undone.`,
    );
    if (!shouldDelete) return;

    setDeletingExamId(exam.id);
    try {
      setExamActionNotice(null);
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/api/exams/${exam.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const refreshed = await refreshDashboardData();
      if (refreshed) {
        setExamActionNotice({
          type: "success",
          message: "Draft deleted and dashboard refreshed.",
        });
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setExamActionNotice({
          type: "error",
          message: err.response?.data?.error ?? "Failed to delete the draft.",
        });
      } else {
        setExamActionNotice({
          type: "error",
          message: "Failed to delete the draft.",
        });
      }
    } finally {
      setDeletingExamId(null);
    }
  };

  const totalExams = exams.length;
  const liveExams = exams.filter((exam) => isExamLive(exam, currentTimeMs));
  const draftExams = exams.filter((exam) => !isExamLive(exam, currentTimeMs));
  const activeSessions = liveExams.length;
  const drafts = draftExams.length;
  const departmentsById = Object.fromEntries(
    departments.map((department) => [department.id, department]),
  ) as Record<string, Department>;
  const selectedBatch = batches.find((batch) => batch.id === batchId) ?? null;
  const computedEndTime = calculateEndTime(startTime, durationMin);

  const getExamBatchLabel = (exam: Exam) => {
    const batch = exam.eligibilities?.[0]?.batch;
    if (!batch) {
      return "No batch assigned";
    }

    return formatBatchLabel(batch, batch.department?.code);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0 border-r border-primary/10 bg-white dark:bg-background-dark flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-white">
            <span className="material-symbols-outlined">shield_person</span>
          </div>
          <div>
            <h1 className="text-primary font-bold text-lg leading-tight">
              Lab Proctor
            </h1>
            <p className="text-xs text-secondary font-medium">Teacher Portal</p>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <a
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium"
            href="#"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </a>
          <a
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary/5 text-slate-600 dark:text-slate-400 font-medium"
            href="#"
          >
            <span className="material-symbols-outlined">description</span>
            <span>Drafts</span>
          </a>
          <a
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary/5 text-slate-600 dark:text-slate-400 font-medium"
            href="#"
          >
            <span className="material-symbols-outlined">podcasts</span>
            <span>Live Sessions</span>
          </a>
          <a
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary/5 text-slate-600 dark:text-slate-400 font-medium"
            href="#"
          >
            <span className="material-symbols-outlined">analytics</span>
            <span>Results</span>
          </a>
        </nav>
        <div className="p-4 border-t border-primary/10">
          <a
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary/5 text-slate-600 dark:text-slate-400 font-medium"
            href="#"
          >
            <span className="material-symbols-outlined">settings</span>
            <span>Settings</span>
          </a>
          <div className="mt-4 flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-primary/5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-8 w-8 shrink-0 rounded-full bg-secondary/30 flex items-center justify-center text-primary font-bold text-sm">
                {user?.name?.[0]?.toUpperCase() ?? "T"}
              </div>
              <div className="text-sm overflow-hidden flex-1">
                <p className="font-bold truncate">{user?.name ?? "Teacher"}</p>
                <p className="text-xs text-slate-500">
                  {user?.role ?? "FACULTY"}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.push("/auth/teacher/login");
              }}
              className="text-slate-400 hover:text-red-500 transition-colors p-1"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-[20px]">
                logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-8">
        {/* Header Section */}
        <header className="mb-8">
          <h2 className="text-3xl font-black text-primary tracking-tight">
            Teacher Dashboard
          </h2>
          <p className="text-slate-500 mt-1">
            Manage your lab exams, questions, and active proctoring sessions.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">
              progress_activity
            </span>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
            {error}
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-primary/10 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-500 text-sm font-medium">
                    Total Exams
                  </p>
                  <span className="material-symbols-outlined text-secondary">
                    library_books
                  </span>
                </div>
                <p className="text-3xl font-bold text-primary">{totalExams}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-primary/10 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-500 text-sm font-medium">
                    Active Sessions
                  </p>
                  <span className="material-symbols-outlined text-green-500">
                    sensors
                  </span>
                </div>
                <p className="text-3xl font-bold text-primary">
                  {activeSessions}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-primary/10 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-500 text-sm font-medium">Drafts</p>
                  <span className="material-symbols-outlined text-accent">
                    edit_note
                  </span>
                </div>
                <p className="text-3xl font-bold text-primary">{drafts}</p>
              </div>
            </div>

            {examActionNotice ? (
              <div
                className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${
                  examActionNotice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-600"
                }`}
              >
                {examActionNotice.message}
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Create Exam Section */}
              <section className="bg-white dark:bg-slate-800 rounded-xl border border-primary/10 shadow-md overflow-hidden flex flex-col">
                <div className="p-6 border-b border-primary/5 bg-primary/5">
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined">
                      add_circle
                    </span>
                    Create New Exam
                  </h3>
                </div>
                <form onSubmit={handleCreateExam} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Exam Title
                    </label>
                    <input
                      required
                      className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-slate-900 focus:ring-secondary focus:border-secondary p-3"
                      placeholder="e.g. Data Structures Midterm"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <textarea
                      className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-slate-900 focus:ring-secondary focus:border-secondary p-3"
                      placeholder="Brief description of the exam..."
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Batch
                    </label>
                    <select
                      required
                      className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-slate-900 focus:ring-secondary focus:border-secondary p-3"
                      value={batchId}
                      onChange={(e) => setBatchId(e.target.value)}
                    >
                      <option value="">
                        {batches.length === 0
                          ? "No active batches available"
                          : "Select a batch"}
                      </option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {formatBatchLabel(
                            batch,
                            departmentsById[batch.departmentId]?.code,
                          )}
                        </option>
                      ))}
                    </select>
                    {batches.length === 0 ? (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        No active batches are available yet. Create one from the
                        admin dashboard first.
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Start Time
                      </label>
                      <input
                        required
                        className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-slate-900 p-3"
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Duration (Minutes)
                      </label>
                      <input
                        required
                        className="w-full rounded-lg border-primary/20 bg-background-light dark:bg-slate-900 p-3"
                        type="number"
                        min={1}
                        value={durationMin}
                        onChange={(e) => setDurationMin(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  {computedEndTime ? (
                    <div className="rounded-lg border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      Ends automatically at{" "}
                      <span className="font-semibold text-primary">
                        {formatDateTimePreview(computedEndTime)}
                      </span>
                      {selectedBatch ? (
                        <>
                          {" "}
                          for{" "}
                          <span className="font-semibold text-primary">
                            {formatBatchLabel(
                              selectedBatch,
                              departmentsById[selectedBatch.departmentId]?.code,
                            )}
                          </span>
                        </>
                      ) : null}
                      .
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    disabled={creating || batches.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-70"
                  >
                    {creating ? (
                      <span className="material-symbols-outlined animate-spin">
                        progress_activity
                      </span>
                    ) : (
                      <span className="material-symbols-outlined">
                        arrow_forward
                      </span>
                    )}
                    Continue
                  </button>
                  {createError && (
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-base">
                        error
                      </span>
                      {createError}
                    </p>
                  )}
                </form>
              </section>

              {/* Host Exam Section (Drafts) */}
              <section className="bg-white dark:bg-slate-800 rounded-xl border border-primary/10 shadow-md overflow-hidden flex flex-col">
                <div className="p-6 border-b border-primary/5 bg-secondary/5">
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined">
                      rocket_launch
                    </span>
                    Host Exam (Drafts)
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                  <div className="divide-y divide-primary/5">
                    {draftExams.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        No drafts available. Create an exam to get started.
                      </div>
                    ) : (
                      draftExams.map((exam, i) => (
                        <div
                          key={exam.id}
                          className="p-4 hover:bg-background-light dark:hover:bg-slate-900 flex items-center justify-between group transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center text-primary font-bold">
                              {String(i + 1).padStart(2, "0")}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200">
                                {exam.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {exam._count?.questions || 0} Questions •{" "}
                                {getExamBatchLabel(exam)} • Starts{" "}
                                {formatExamDateTime(exam.startTime)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`/teacher/exams?examId=${exam.id}`}
                              className="px-3 py-2 text-sm font-bold text-primary transition-colors hover:underline"
                            >
                              Edit
                            </a>
                            <button
                              onClick={() => handleDeleteDraft(exam)}
                              disabled={deletingExamId === exam.id}
                              className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-bold transition-colors hover:bg-red-50 disabled:opacity-60"
                            >
                              {deletingExamId === exam.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                            <button
                              onClick={() => handleGoLive(exam.id)}
                              disabled={activeActionExamId === exam.id}
                              className="px-4 py-2 bg-secondary hover:bg-primary text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2 shrink-0 disabled:opacity-60"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                play_arrow
                              </span>
                              {activeActionExamId === exam.id
                                ? "Starting..."
                                : "Go Live"}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {drafts > 0 && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 text-center border-t border-primary/5">
                    <button className="text-secondary text-sm font-bold hover:underline">
                      View all {drafts} drafts
                    </button>
                  </div>
                )}
              </section>
            </div>

            {/* Recent Activity */}
            <div className="mt-10">
              <h3 className="text-xl font-bold text-primary mb-4 px-1">
                Active Proctored Sessions
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-primary/10 shadow-sm overflow-hidden">
                {liveExams.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl block mb-2">
                      podcasts
                    </span>
                    No active sessions. Go live on a draft exam to start
                    proctoring.
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-primary/5 text-primary text-sm uppercase tracking-wider font-bold">
                      <tr>
                        <th className="px-6 py-4">Session Name</th>
                        <th className="px-6 py-4">Attempts</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Duration</th>
                        <th className="px-6 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {liveExams.map((exam) => (
                        <tr key={exam.id}>
                          <td className="px-6 py-4 font-medium">
                            <p>{exam.title}</p>
                            <p className="mt-1 text-xs font-normal text-slate-500">
                              {getExamBatchLabel(exam)}
                            </p>
                            <p className="mt-1 text-xs font-normal text-slate-400">
                              Ends {formatExamDateTime(exam.endTime)}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {exam._count?.attempts ?? 0} Attempt
                            {(exam._count?.attempts ?? 0) !== 1 ? "s" : ""}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase">
                              Live
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {exam.durationMin} min
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <a
                                href={`/teacher/exams?examId=${exam.id}`}
                                className="text-primary font-bold text-sm hover:underline"
                              >
                                View
                              </a>
                              <button
                                onClick={() => handleForceStopExam(exam)}
                                disabled={activeActionExamId === exam.id}
                                className="text-sm font-bold text-red-600 transition-colors hover:underline disabled:opacity-60"
                              >
                                {activeActionExamId === exam.id
                                  ? "Stopping..."
                                  : "Force Stop"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
