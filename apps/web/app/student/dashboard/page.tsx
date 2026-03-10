"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface User { id: string; name: string; email: string; role: string }
interface Attempt {
  id: string; status: string; score: number | null;
  startedAt: string; completedAt: string | null; retakeNumber: number;
}
interface Exam {
  id: string; title: string; description?: string;
  isActive: boolean; startTime: string; endTime: string;
  durationMin: number; _count: { questions: number };
  attempts?: Attempt[];
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("en-IN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function LabProctorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/auth/student/login"); return; }
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));

    async function fetchData() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [meRes, examsRes] = await Promise.all([
          axios.get<User>(`${API_URL}/api/me`, { headers }),
          axios.get<Exam[]>(`${API_URL}/api/getExams`, { headers }),
        ]);
        setUser(meRes.data);
        setExams(examsRes.data);
      } catch {
        // keep stored user, show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  const liveExams = exams.filter((e) => e.isActive);
  const now = new Date();
  const upcomingExams = exams.filter(
    (e) => !e.isActive && new Date(e.startTime) > now,
  );
  const firstName = user?.name?.split(" ")[0] ?? "Student";
  const liveCount = liveExams.length;
  const upcomingCount = upcomingExams.length;

  return (
    <div className="bg-background-light text-slate-900 min-h-screen">
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-primary/10 bg-white px-6 md:px-10 py-4 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 text-primary">
              <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white">
                <span className="material-symbols-outlined">biotech</span>
              </div>
              <h2 className="text-primary text-xl font-bold tracking-tight">
                LabProctor
              </h2>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a className="text-primary font-semibold border-b-2 border-primary pb-1 text-sm" href="#">
                Dashboard
              </a>
              <a className="text-slate-500 hover:text-primary transition-colors text-sm font-medium" href="#">
                My Exams
              </a>
              <a className="text-slate-500 hover:text-primary transition-colors text-sm font-medium" href="#">
                History
              </a>
              <a className="text-slate-500 hover:text-primary transition-colors text-sm font-medium" href="#">
                Support
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center bg-slate-100 rounded-lg px-3 py-1.5">
              <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-48 placeholder:text-slate-400 outline-none"
                placeholder="Search exams..."
                type="text"
              />
            </div>
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900">{user?.name ?? "Student"}</p>
                <p className="text-[10px] text-slate-500">{user?.email?.split("@")[0] ?? ""}</p>
              </div>
              <div className="size-10 rounded-full bg-secondary flex items-center justify-center text-white border-2 border-white shadow-sm font-bold">
                {user?.name?.[0]?.toUpperCase() ?? "S"}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10">
          {loading ? (
            <div className="flex justify-center py-20">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-primary mb-2">
                  Welcome back, {firstName}
                </h1>
                <p className="text-slate-600">
                  {liveCount > 0 ? (
                    <>
                      You have{" "}
                      <span className="font-semibold text-primary">
                        {liveCount} active exam{liveCount !== 1 ? "s" : ""}
                      </span>{" "}
                      {upcomingCount > 0 && `and ${upcomingCount} upcoming session${upcomingCount !== 1 ? "s" : ""} scheduled`}.
                    </>
                  ) : upcomingCount > 0 ? (
                    <>
                      You have{" "}
                      <span className="font-semibold text-primary">
                        {upcomingCount} upcoming exam{upcomingCount !== 1 ? "s" : ""}
                      </span>{" "}
                      scheduled.
                    </>
                  ) : (
                    "No exams assigned yet. Check back later."
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  {/* Live Exam Section */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-red-500">sensors</span>
                        Live Now
                      </h3>
                      {liveCount > 0 && (
                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 animate-pulse">
                          In Progress
                        </span>
                      )}
                    </div>
                    {liveCount === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 shadow-sm">
                        <span className="material-symbols-outlined text-3xl block mb-2">event_busy</span>
                        No live exams right now.
                      </div>
                    ) : (
                      liveExams.slice(0, 1).map((exam) => (
                        <div key={exam.id} className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow">
                          <div className="p-6 md:flex gap-6">
                            <div className="md:w-1/3 mb-4 md:mb-0">
                              <div className="aspect-video md:aspect-square bg-primary/10 rounded-lg flex items-center justify-center relative">
                                <span className="material-symbols-outlined text-primary text-4xl">code</span>
                              </div>
                            </div>
                            <div className="md:w-2/3 flex flex-col justify-between">
                              <div>
                                <h4 className="text-xl font-bold text-primary mb-3">{exam.title}</h4>
                                {exam.description && (
                                  <p className="text-slate-500 text-sm mb-3">{exam.description}</p>
                                )}
                                <div className="space-y-2 mb-6">
                                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                                    <span className="material-symbols-outlined text-base">timer</span>
                                    Duration: {exam.durationMin} Minutes
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                                    <span className="material-symbols-outlined text-base">quiz</span>
                                    {exam._count.questions} Question{exam._count.questions !== 1 ? "s" : ""}
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                                    <span className="material-symbols-outlined text-base">schedule</span>
                                    Ends: {formatDateTime(exam.endTime)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <button className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2 group flex-1 justify-center">
                                  Enter Exam Room
                                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                                    arrow_forward
                                  </span>
                                </button>
                                <button className="bg-slate-100 text-slate-700 font-semibold p-3 rounded-lg hover:bg-slate-200 transition-all">
                                  <span className="material-symbols-outlined">help</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </section>

                  {/* Upcoming Exams Section */}
                  <section>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary">calendar_month</span>
                      Upcoming This Week
                    </h3>
                    {upcomingCount === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 shadow-sm">
                        <span className="material-symbols-outlined text-3xl block mb-2">calendar_month</span>
                        No upcoming exams scheduled.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {upcomingExams.slice(0, 4).map((exam) => (
                          <div key={exam.id} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:border-secondary transition-colors">
                            <div className="flex justify-between items-start mb-3">
                              <div className="size-10 rounded bg-secondary/10 text-secondary flex items-center justify-center">
                                <span className="material-symbols-outlined">assignment</span>
                              </div>
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase">
                                {formatDateTime(exam.startTime)}
                              </span>
                            </div>
                            <h5 className="font-bold text-primary mb-1 truncate">{exam.title}</h5>
                            <p className="text-xs text-slate-500 mb-4">
                              {exam._count.questions} Question{exam._count.questions !== 1 ? "s" : ""} • {exam.durationMin} mins
                            </p>
                            <div className="flex items-center justify-end">
                              <button className="text-xs font-bold text-primary hover:underline">View Guidelines</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                  {/* System Readiness */}
                  <section className="bg-primary text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                      <h3 className="text-xl font-bold mb-4">System Readiness</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-accent">videocam</span>
                            <span className="text-sm font-medium">Camera</span>
                          </div>
                          <span className="material-symbols-outlined text-green-400">check_circle</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-accent">mic</span>
                            <span className="text-sm font-medium">Microphone</span>
                          </div>
                          <span className="material-symbols-outlined text-green-400">check_circle</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-accent">wifi</span>
                            <span className="text-sm font-medium">Network</span>
                          </div>
                          <span className="text-xs font-bold bg-green-400 text-primary px-2 py-0.5 rounded-full">
                            Stable
                          </span>
                        </div>
                      </div>
                      <button className="mt-6 w-full py-2 bg-accent text-primary font-bold rounded-lg hover:bg-white transition-colors text-sm">
                        Run Diagnostics
                      </button>
                    </div>
                    <div className="absolute -bottom-10 -right-10 size-40 bg-secondary/10 rounded-full blur-2xl"></div>
                  </section>

                  {/* Recent Results */}
                  <section className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Results</h3>
                    {exams.filter((e) => e.attempts && e.attempts.length > 0).length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No completed exams yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {exams
                          .filter((e) => e.attempts && e.attempts.length > 0 && e.attempts[0].completedAt)
                          .slice(0, 3)
                          .map((exam) => {
                            const attempt = exam.attempts![0];
                            return (
                              <div key={exam.id}>
                                <div className="flex items-center justify-between group cursor-pointer">
                                  <div>
                                    <p className="text-sm font-bold text-primary group-hover:underline truncate max-w-[140px]">
                                      {exam.title}
                                    </p>
                                    <p className="text-[10px] text-slate-500 italic">
                                      {attempt.completedAt ? `Submitted ${new Date(attempt.completedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}` : "In progress"}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-slate-900">
                                      {attempt.score !== null ? `${attempt.score}` : "—"}
                                    </p>
                                    <p className={`text-[10px] font-bold ${attempt.status === "COMPLETED" ? "text-green-500" : "text-yellow-500"}`}>
                                      {attempt.status}
                                    </p>
                                  </div>
                                </div>
                                <hr className="border-slate-50 mt-4" />
                              </div>
                            );
                          })}
                      </div>
                    )}
                    <button className="mt-4 w-full py-2 text-primary font-bold border-2 border-primary/20 rounded-lg hover:bg-primary/5 transition-colors text-xs">
                      View All Results
                    </button>
                  </section>

                  {/* Proctor Tip */}
                  <section className="bg-accent/10 p-6 rounded-xl border border-accent/20">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-primary">info</span>
                      <h4 className="font-bold text-primary">Proctor Tip</h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Ensure your room is well-lit and your desk is clear of any
                      unauthorized materials before starting your session.
                    </p>
                  </section>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-100 py-8 mt-12">
          <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 opacity-60">
              <span className="material-symbols-outlined text-primary text-xl">biotech</span>
              <span className="text-sm font-bold text-primary">LabProctor v2.4.0</span>
            </div>
            <div className="flex gap-6 text-xs font-medium text-slate-500">
              <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
              <a className="hover:text-primary transition-colors" href="#">Terms of Service</a>
              <a className="hover:text-primary transition-colors" href="#">Honor Code</a>
            </div>
            <div className="text-xs text-slate-400">© 2024 LabProctor Systems Inc.</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
