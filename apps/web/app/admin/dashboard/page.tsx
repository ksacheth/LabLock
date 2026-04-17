"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REQUIRED_ROLE = "ADMIN";

function getDashboardPathForRole(role: string) {
  if (role === "STUDENT") return "/student/dashboard";
  if (role === "FACULTY") return "/teacher/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/auth";
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId?: string | null;
  batchId?: string | null;
  rollNumber?: string | null;
  department?: { id: string; name: string; code: string } | null;
  batch?: {
    id: string;
    label: string;
    yearOfStudy: number;
    intakeYear: number;
  } | null;
}

interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  _count: { batches: number; users: number };
}

interface Batch {
  id: string;
  label: string;
  yearOfStudy: number;
  intakeYear: number;
  isActive: boolean;
  departmentId: string;
  department: { id: string; name: string; code: string };
  _count: { users: number };
}

type Tab = "overview" | "departments" | "batches" | "users";

// ─── Toast Component ─────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

let toastId = 0;

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-md transition-all animate-[slideUp_0.3s_ease-out] ${
            t.type === "success"
              ? "bg-emerald-600/90 text-white"
              : "bg-red-600/90 text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {t.type === "success" ? "check_circle" : "error"}
          </span>
          {t.message}
          <button
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
            onClick={() => onDismiss(t.id)}
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Modal Wrapper ───────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-lg rounded-2xl border border-primary/10 bg-white p-8 shadow-2xl dark:bg-slate-900 animate-[scaleIn_0.2s_ease-out]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Modal states
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form states – Department
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptActive, setDeptActive] = useState(true);
  const [deptSubmitting, setDeptSubmitting] = useState(false);

  // Form states – Batch
  const [batchDeptId, setBatchDeptId] = useState("");
  const [batchYear, setBatchYear] = useState(1);
  const [batchIntake, setBatchIntake] = useState(new Date().getFullYear());
  const [batchLabel, setBatchLabel] = useState("");
  const [batchActive, setBatchActive] = useState(true);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Form states – User edit
  const [userRole, setUserRole] = useState("");
  const [userDeptId, setUserDeptId] = useState("");
  const [userBatchId, setUserBatchId] = useState("");
  const [userRollNumber, setUserRollNumber] = useState("");
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Search
  const [userSearch, setUserSearch] = useState("");
  const [deptSearch, setDeptSearch] = useState("");
  const [batchFilter, setBatchFilterDept] = useState("");

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const headers = getHeaders();
      const [meRes, usersRes, departmentsRes, batchesRes] = await Promise.all([
        axios.get<User>(`${API_URL}/api/me`, { headers }),
        axios.get<User[]>(`${API_URL}/api/users`, { headers }),
        axios.get<Department[]>(`${API_URL}/api/admin/departments`, {
          headers,
        }),
        axios.get<Batch[]>(`${API_URL}/api/admin/batches`, { headers }),
      ]);

      if (meRes.data.role !== REQUIRED_ROLE) {
        router.replace(getDashboardPathForRole(meRes.data.role));
        return;
      }

      setUser(meRes.data);
      setUsers(usersRes.data);
      setDepartments(departmentsRes.data);
      setBatches(batchesRes.data);
    } catch (err) {
      console.error("Failed to load admin dashboard", err);
      setError("Failed to load admin dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [getHeaders, router]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/auth/admin/login");
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
        setUser(parsedUser);
      } catch {
        localStorage.removeItem("user");
      }
    }

    fetchAll();
  }, [router, fetchAll]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function getApiError(err: unknown): string {
    if (err instanceof AxiosError && err.response?.data) {
      const d = err.response.data as Record<string, unknown>;
      if (typeof d.error === "string") return d.error;
      if (d.errors) {
        const firstKey = Object.keys(d.errors)[0];
        const msgs = (d.errors as Record<string, string[]>)[firstKey!];
        if (msgs?.length) return msgs[0]!;
      }
    }
    return "An unexpected error occurred.";
  }

  async function handleCreateDepartment(e: FormEvent) {
    e.preventDefault();
    setDeptSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/departments`,
        { name: deptName, code: deptCode.toUpperCase(), isActive: deptActive },
        { headers: getHeaders() }
      );
      addToast(`Department "${deptName}" created successfully!`, "success");
      setShowDeptModal(false);
      setDeptName("");
      setDeptCode("");
      setDeptActive(true);
      await fetchAll();
    } catch (err) {
      addToast(getApiError(err), "error");
    } finally {
      setDeptSubmitting(false);
    }
  }

  async function handleCreateBatch(e: FormEvent) {
    e.preventDefault();
    setBatchSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/batches`,
        {
          departmentId: batchDeptId,
          yearOfStudy: batchYear,
          intakeYear: batchIntake,
          label: batchLabel,
          isActive: batchActive,
        },
        { headers: getHeaders() }
      );
      addToast(`Batch "${batchLabel}" created successfully!`, "success");
      setShowBatchModal(false);
      setBatchDeptId("");
      setBatchYear(1);
      setBatchIntake(new Date().getFullYear());
      setBatchLabel("");
      setBatchActive(true);
      await fetchAll();
    } catch (err) {
      addToast(getApiError(err), "error");
    } finally {
      setBatchSubmitting(false);
    }
  }

  function openUserEditModal(u: User) {
    setEditingUser(u);
    setUserRole(u.role);
    setUserDeptId(u.departmentId ?? "");
    setUserBatchId(u.batchId ?? "");
    setUserRollNumber(u.rollNumber ?? "");
    setShowUserModal(true);
  }

  async function handleUpdateUser(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setUserSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      if (userRole !== editingUser.role) payload.role = userRole;

      if (userRole === "STUDENT") {
        if (userDeptId !== (editingUser.departmentId ?? ""))
          payload.departmentId = userDeptId || null;
        if (userBatchId !== (editingUser.batchId ?? ""))
          payload.batchId = userBatchId || null;
        if (userRollNumber !== (editingUser.rollNumber ?? ""))
          payload.rollNumber = userRollNumber || null;
      }

      await axios.patch(`${API_URL}/api/admin/users/${editingUser.id}`, payload, {
        headers: getHeaders(),
      });
      addToast(`User "${editingUser.name}" updated successfully!`, "success");
      setShowUserModal(false);
      setEditingUser(null);
      await fetchAll();
    } catch (err) {
      addToast(getApiError(err), "error");
    } finally {
      setUserSubmitting(false);
    }
  }

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredDepartments = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(deptSearch.toLowerCase()) ||
      d.code.toLowerCase().includes(deptSearch.toLowerCase())
  );

  const filteredBatches = batchFilter
    ? batches.filter((b) => b.departmentId === batchFilter)
    : batches;

  // ─── Derived Stats ────────────────────────────────────────────────────────

  const studentCount = users.filter((u) => u.role === "STUDENT").length;
  const facultyCount = users.filter((u) => u.role === "FACULTY").length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const activeDepartments = departments.filter((d) => d.isActive).length;
  const activeBatches = batches.filter((b) => b.isActive).length;

  // ─── Tab Configuration ────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "space_dashboard" },
    { key: "departments", label: "Departments", icon: "domain" },
    { key: "batches", label: "Batches", icon: "groups_2" },
    { key: "users", label: "Users", icon: "group" },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  const inputClasses =
    "w-full rounded-xl border border-primary/15 bg-background-light px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-950/50 dark:text-slate-100 dark:border-slate-700 dark:focus:border-primary";

  const labelClasses = "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5";

  const primaryBtnClasses =
    "inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:brightness-110 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

  const secondaryBtnClasses =
    "inline-flex items-center gap-2 rounded-xl border border-primary/15 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-primary/5 hover:text-primary dark:text-slate-300 dark:hover:bg-primary/10";

  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      STUDENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      FACULTY: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    };
    return `rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${map[role] ?? "bg-slate-100 text-slate-600"}`;
  };

  const statusBadge = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
      active
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
    }`;

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="flex min-h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
        {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 border-r border-primary/10 bg-white dark:bg-background-dark flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center text-white">
              <span className="material-symbols-outlined">
                admin_panel_settings
              </span>
            </div>
            <div>
              <h1 className="text-primary font-bold text-lg leading-tight">
                Lab Proctor
              </h1>
              <p className="text-xs text-secondary font-medium">Admin Console</p>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all text-left ${
                  activeTab === tab.key
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 dark:text-slate-400 hover:bg-primary/5"
                }`}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.key === "departments" && departments.length > 0 && (
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {departments.length}
                  </span>
                )}
                {tab.key === "batches" && batches.length > 0 && (
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {batches.length}
                  </span>
                )}
                {tab.key === "users" && users.length > 0 && (
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {users.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-primary/10">
            <div className="rounded-xl border border-primary/10 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Signed in as
              </p>
              <p className="mt-2 font-bold text-slate-900 dark:text-slate-100">
                {user?.name ?? "Admin"}
              </p>
              <p className="text-sm text-slate-500">{user?.email ?? ""}</p>
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  router.push("/auth/admin/login");
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/15 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-primary/5 hover:text-primary dark:text-slate-300"
              >
                <span className="material-symbols-outlined text-[18px]">
                  logout
                </span>
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* ─── Main Content ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                progress_activity
              </span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : (
            <>
              {/* ═══ OVERVIEW TAB ═══ */}
              {activeTab === "overview" && (
                <div className="space-y-10">
                  <header className="mb-8">
                    <h2 className="text-3xl font-black text-primary tracking-tight">
                      Admin Dashboard
                    </h2>
                    <p className="mt-2 max-w-3xl text-slate-500">
                      Review user distribution, academic structure, and
                      provisioned access across the online examination platform.
                    </p>
                  </header>

                  {/* Stats Cards */}
                  <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: "Total Users",
                        value: users.length,
                        sub: `${studentCount} students, ${facultyCount} faculty, ${adminCount} admins`,
                        icon: "group",
                      },
                      {
                        label: "Departments",
                        value: departments.length,
                        sub: `${activeDepartments} currently active`,
                        icon: "domain",
                      },
                      {
                        label: "Batches",
                        value: batches.length,
                        sub: `${activeBatches} currently active`,
                        icon: "groups_2",
                      },
                      {
                        label: "Faculty Coverage",
                        value: facultyCount,
                        sub: "Teachers provisioned on the platform",
                        icon: "person_book",
                      },
                    ].map((card) => (
                      <article
                        key={card.label}
                        className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/50 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-500">
                            {card.label}
                          </p>
                          <span className="material-symbols-outlined text-primary/40">
                            {card.icon}
                          </span>
                        </div>
                        <p className="mt-3 text-4xl font-black text-primary">
                          {card.value}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">{card.sub}</p>
                      </article>
                    ))}
                  </section>

                  {/* Quick Actions */}
                  <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
                    <button
                      onClick={() => {
                        setActiveTab("departments");
                        setShowDeptModal(true);
                      }}
                      className="group rounded-2xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/50 text-left hover:shadow-md hover:border-primary/25 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                          <span className="material-symbols-outlined text-primary text-[28px]">
                            domain_add
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            Create Department
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Add a new academic department to the system.
                          </p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab("batches");
                        setShowBatchModal(true);
                      }}
                      className="group rounded-2xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/50 text-left hover:shadow-md hover:border-primary/25 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                          <span className="material-symbols-outlined text-primary text-[28px]">
                            group_add
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            Create Batch
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Define a new year-wise cohort for a department.
                          </p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab("users")}
                      className="group rounded-2xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/50 text-left hover:shadow-md hover:border-primary/25 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                          <span className="material-symbols-outlined text-primary text-[28px]">
                            manage_accounts
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            Manage Users
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Assign roles, departments, and batches to users.
                          </p>
                        </div>
                      </div>
                    </button>
                  </section>

                  {/* Recent Activity Preview */}
                  <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                    {/* Recent Departments */}
                    <article className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/50">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-primary">
                          Recent Departments
                        </h3>
                        <button
                          onClick={() => setActiveTab("departments")}
                          className="text-sm font-medium text-primary/70 hover:text-primary transition-colors"
                        >
                          View all →
                        </button>
                      </div>
                      <div className="space-y-3">
                        {departments.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-primary/15 px-4 py-6 text-center text-sm text-slate-500">
                            No departments yet. Create your first one!
                          </p>
                        ) : (
                          departments.slice(0, 3).map((dept) => (
                            <div
                              key={dept.id}
                              className="flex items-center justify-between rounded-xl border border-primary/10 px-4 py-3"
                            >
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                  {dept.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {dept.code} · {dept._count.batches} batches ·{" "}
                                  {dept._count.users} users
                                </p>
                              </div>
                              <span className={statusBadge(dept.isActive)}>
                                {dept.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </article>

                    {/* Recent Batches */}
                    <article className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/50">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-primary">
                          Recent Batches
                        </h3>
                        <button
                          onClick={() => setActiveTab("batches")}
                          className="text-sm font-medium text-primary/70 hover:text-primary transition-colors"
                        >
                          View all →
                        </button>
                      </div>
                      <div className="space-y-3">
                        {batches.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-primary/15 px-4 py-6 text-center text-sm text-slate-500">
                            No batches yet. Create departments first.
                          </p>
                        ) : (
                          batches.slice(0, 4).map((batch) => (
                            <div
                              key={batch.id}
                              className="flex items-center justify-between rounded-xl border border-primary/10 px-4 py-3"
                            >
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                  {batch.label}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {batch.department.code} · Year{" "}
                                  {batch.yearOfStudy} · Intake{" "}
                                  {batch.intakeYear} · {batch._count.users} users
                                </p>
                              </div>
                              <span className={statusBadge(batch.isActive)}>
                                {batch.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </article>
                  </section>
                </div>
              )}

              {/* ═══ DEPARTMENTS TAB ═══ */}
              {activeTab === "departments" && (
                <div className="space-y-6">
                  <header className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-black text-primary tracking-tight">
                        Departments
                      </h2>
                      <p className="mt-1 text-slate-500">
                        Manage academic departments across the platform.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeptModal(true)}
                      className={primaryBtnClasses}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        add
                      </span>
                      Create Department
                    </button>
                  </header>

                  {/* Search */}
                  <div className="relative max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Search departments..."
                      value={deptSearch}
                      onChange={(e) => setDeptSearch(e.target.value)}
                      className={`${inputClasses} pl-10`}
                    />
                  </div>

                  {/* Table */}
                  <div className="rounded-2xl border border-primary/10 bg-white shadow-sm overflow-hidden dark:bg-slate-900/50">
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 bg-background-light px-6 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/40">
                      <span>Name</span>
                      <span>Code</span>
                      <span>Batches</span>
                      <span>Users</span>
                      <span>Status</span>
                    </div>
                    <div className="divide-y divide-primary/10">
                      {filteredDepartments.length === 0 ? (
                        <div className="px-6 py-10 text-center">
                          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
                            domain_disabled
                          </span>
                          <p className="mt-2 text-sm text-slate-500">
                            {departments.length === 0
                              ? "No departments created yet."
                              : "No departments match your search."}
                          </p>
                          {departments.length === 0 && (
                            <button
                              onClick={() => setShowDeptModal(true)}
                              className={`${primaryBtnClasses} mt-4`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                add
                              </span>
                              Create First Department
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredDepartments.map((dept) => (
                          <div
                            key={dept.id}
                            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center px-6 py-4 text-sm hover:bg-primary/[0.02] transition-colors"
                          >
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {dept.name}
                            </p>
                            <p className="font-mono text-xs bg-slate-100 dark:bg-slate-800 rounded-md px-2 py-1 w-fit">
                              {dept.code}
                            </p>
                            <p>{dept._count.batches}</p>
                            <p>{dept._count.users}</p>
                            <span className={statusBadge(dept.isActive)}>
                              {dept.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ BATCHES TAB ═══ */}
              {activeTab === "batches" && (
                <div className="space-y-6">
                  <header className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-black text-primary tracking-tight">
                        Batches
                      </h2>
                      <p className="mt-1 text-slate-500">
                        Manage year-wise cohorts across departments.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowBatchModal(true)}
                      disabled={departments.length === 0}
                      className={primaryBtnClasses}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        add
                      </span>
                      Create Batch
                    </button>
                  </header>

                  {/* Filter by department */}
                  <div className="flex items-center gap-4">
                    <select
                      value={batchFilter}
                      onChange={(e) => setBatchFilterDept(e.target.value)}
                      className={`${inputClasses} max-w-xs`}
                    >
                      <option value="">All Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                    {batchFilter && (
                      <button
                        onClick={() => setBatchFilterDept("")}
                        className="text-sm text-primary/70 hover:text-primary font-medium"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>

                  {/* Table */}
                  <div className="rounded-2xl border border-primary/10 bg-white shadow-sm overflow-hidden dark:bg-slate-900/50">
                    <div className="grid grid-cols-[1.5fr_1.5fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 bg-background-light px-6 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/40">
                      <span>Department</span>
                      <span>Label</span>
                      <span>Year</span>
                      <span>Intake</span>
                      <span>Users</span>
                      <span>Status</span>
                    </div>
                    <div className="divide-y divide-primary/10">
                      {filteredBatches.length === 0 ? (
                        <div className="px-6 py-10 text-center">
                          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
                            group_off
                          </span>
                          <p className="mt-2 text-sm text-slate-500">
                            {batches.length === 0
                              ? "No batches created yet."
                              : "No batches match your filter."}
                          </p>
                          {batches.length === 0 && departments.length > 0 && (
                            <button
                              onClick={() => setShowBatchModal(true)}
                              className={`${primaryBtnClasses} mt-4`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                add
                              </span>
                              Create First Batch
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredBatches.map((batch) => (
                          <div
                            key={batch.id}
                            className="grid grid-cols-[1.5fr_1.5fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 items-center px-6 py-4 text-sm hover:bg-primary/[0.02] transition-colors"
                          >
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {batch.department.code}
                              </p>
                              <p className="text-xs text-slate-500">
                                {batch.department.name}
                              </p>
                            </div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {batch.label}
                            </p>
                            <p>{batch.yearOfStudy}</p>
                            <p>{batch.intakeYear}</p>
                            <p>{batch._count.users}</p>
                            <span className={statusBadge(batch.isActive)}>
                              {batch.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ USERS TAB ═══ */}
              {activeTab === "users" && (
                <div className="space-y-6">
                  <header>
                    <h2 className="text-3xl font-black text-primary tracking-tight">
                      Users
                    </h2>
                    <p className="mt-1 text-slate-500">
                      Manage user roles, departments, and batch assignments.
                    </p>
                  </header>

                  {/* Search */}
                  <div className="relative max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Search users by name, email, or role..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className={`${inputClasses} pl-10`}
                    />
                  </div>

                  {/* Table */}
                  <div className="rounded-2xl border border-primary/10 bg-white shadow-sm overflow-hidden dark:bg-slate-900/50">
                    <div className="grid grid-cols-[2fr_2.5fr_1fr_1.2fr] gap-4 bg-background-light px-6 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/40">
                      <span>Name</span>
                      <span>Email</span>
                      <span>Role</span>
                      <span>Actions</span>
                    </div>
                    <div className="divide-y divide-primary/10">
                      {filteredUsers.length === 0 ? (
                        <div className="px-6 py-10 text-center">
                          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
                            person_off
                          </span>
                          <p className="mt-2 text-sm text-slate-500">
                            No users match your search.
                          </p>
                        </div>
                      ) : (
                        filteredUsers.map((u) => (
                          <div
                            key={u.id}
                            className="grid grid-cols-[2fr_2.5fr_1fr_1.2fr] gap-4 items-center px-6 py-4 text-sm hover:bg-primary/[0.02] transition-colors"
                          >
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {u.name}
                              </p>
                              {u.rollNumber && (
                                <p className="text-xs text-slate-500">
                                  Roll: {u.rollNumber}
                                </p>
                              )}
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 truncate">
                              {u.email}
                            </p>
                            <span className={roleBadge(u.role)}>
                              {u.role}
                            </span>
                            <button
                              onClick={() => openUserEditModal(u)}
                              className={secondaryBtnClasses + " text-xs py-2 px-3"}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                edit
                              </span>
                              Edit
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Showing {filteredUsers.length} of {users.length} users
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ─── MODALS ─────────────────────────────────────────────────────────── */}

      {/* Create Department Modal */}
      <Modal
        open={showDeptModal}
        onClose={() => setShowDeptModal(false)}
        title="Create Department"
      >
        <form onSubmit={handleCreateDepartment} className="space-y-5">
          <div>
            <label htmlFor="dept-name" className={labelClasses}>
              Department Name
            </label>
            <input
              id="dept-name"
              type="text"
              required
              minLength={3}
              maxLength={100}
              placeholder="e.g. Computer Science & Engineering"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="dept-code" className={labelClasses}>
              Department Code
            </label>
            <input
              id="dept-code"
              type="text"
              required
              minLength={2}
              maxLength={10}
              placeholder="e.g. CSE"
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
              className={`${inputClasses} font-mono uppercase`}
            />
            <p className="mt-1 text-xs text-slate-400">
              Short identifier, 2–10 characters.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="dept-active"
              type="checkbox"
              checked={deptActive}
              onChange={(e) => setDeptActive(e.target.checked)}
              className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary/20"
            />
            <label
              htmlFor="dept-active"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Active
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDeptModal(false)}
              className={secondaryBtnClasses}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deptSubmitting}
              className={primaryBtnClasses}
            >
              {deptSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">
                    progress_activity
                  </span>
                  Creating...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">
                    add
                  </span>
                  Create Department
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Batch Modal */}
      <Modal
        open={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="Create Batch"
      >
        <form onSubmit={handleCreateBatch} className="space-y-5">
          <div>
            <label htmlFor="batch-dept" className={labelClasses}>
              Department
            </label>
            <select
              id="batch-dept"
              required
              value={batchDeptId}
              onChange={(e) => setBatchDeptId(e.target.value)}
              className={inputClasses}
            >
              <option value="" disabled>
                Select a department
              </option>
              {departments
                .filter((d) => d.isActive)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="batch-label" className={labelClasses}>
              Batch Label
            </label>
            <input
              id="batch-label"
              type="text"
              required
              minLength={3}
              maxLength={100}
              placeholder="e.g. CSE 2024 Batch A"
              value={batchLabel}
              onChange={(e) => setBatchLabel(e.target.value)}
              className={inputClasses}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="batch-year" className={labelClasses}>
                Year of Study
              </label>
              <select
                id="batch-year"
                value={batchYear}
                onChange={(e) => setBatchYear(Number(e.target.value))}
                className={inputClasses}
              >
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="batch-intake" className={labelClasses}>
                Intake Year
              </label>
              <input
                id="batch-intake"
                type="number"
                required
                min={2000}
                max={new Date().getFullYear() + 1}
                value={batchIntake}
                onChange={(e) => setBatchIntake(Number(e.target.value))}
                className={inputClasses}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="batch-active"
              type="checkbox"
              checked={batchActive}
              onChange={(e) => setBatchActive(e.target.checked)}
              className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary/20"
            />
            <label
              htmlFor="batch-active"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Active
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowBatchModal(false)}
              className={secondaryBtnClasses}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={batchSubmitting}
              className={primaryBtnClasses}
            >
              {batchSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">
                    progress_activity
                  </span>
                  Creating...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">
                    add
                  </span>
                  Create Batch
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setEditingUser(null);
        }}
        title={editingUser ? `Edit ${editingUser.name}` : "Edit User"}
      >
        {editingUser && (
          <form onSubmit={handleUpdateUser} className="space-y-5">
            {/* User info (read-only) */}
            <div className="rounded-xl bg-background-light border border-primary/10 px-4 py-3 dark:bg-slate-950/40">
              <p className="text-sm text-slate-500">
                {editingUser.email}
              </p>
            </div>

            <div>
              <label htmlFor="user-role" className={labelClasses}>
                Role
              </label>
              <select
                id="user-role"
                value={userRole}
                onChange={(e) => {
                  setUserRole(e.target.value);
                  if (e.target.value !== "STUDENT") {
                    setUserDeptId("");
                    setUserBatchId("");
                    setUserRollNumber("");
                  }
                }}
                className={inputClasses}
              >
                <option value="STUDENT">Student</option>
                <option value="FACULTY">Faculty</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {userRole === "STUDENT" && (
              <>
                <div>
                  <label htmlFor="user-dept" className={labelClasses}>
                    Department
                  </label>
                  <select
                    id="user-dept"
                    value={userDeptId}
                    onChange={(e) => {
                      setUserDeptId(e.target.value);
                      setUserBatchId("");
                    }}
                    className={inputClasses}
                  >
                    <option value="">No Department</option>
                    {departments
                      .filter((d) => d.isActive)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                  </select>
                </div>

                {userDeptId && (
                  <div>
                    <label htmlFor="user-batch" className={labelClasses}>
                      Batch
                    </label>
                    <select
                      id="user-batch"
                      value={userBatchId}
                      onChange={(e) => setUserBatchId(e.target.value)}
                      className={inputClasses}
                    >
                      <option value="">No Batch</option>
                      {batches
                        .filter(
                          (b) => b.departmentId === userDeptId && b.isActive
                        )
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label} (Year {b.yearOfStudy}, Intake{" "}
                            {b.intakeYear})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="user-roll" className={labelClasses}>
                    Roll Number
                  </label>
                  <input
                    id="user-roll"
                    type="text"
                    maxLength={20}
                    placeholder="e.g. 22CS001"
                    value={userRollNumber}
                    onChange={(e) => setUserRollNumber(e.target.value)}
                    className={inputClasses}
                  />
                </div>
              </>
            )}

            {userRole !== "STUDENT" && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300">
                <span className="material-symbols-outlined text-[16px] align-middle mr-1">
                  info
                </span>
                Faculty and Admin roles do not have department, batch, or roll
                number assignments.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUserModal(false);
                  setEditingUser(null);
                }}
                className={secondaryBtnClasses}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={userSubmitting}
                className={primaryBtnClasses}
              >
                {userSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">
                      progress_activity
                    </span>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      save
                    </span>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
