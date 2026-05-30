"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
import TeacherNavbar from "../../components/TeacherNavbar";
import {
  API_URL,
  FACULTY_PENDING_APPROVAL_CODE,
  TEACHER_REQUIRED_ROLE as REQUIRED_ROLE,
  getDashboardPathForRole,
} from "../../lib/auth";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  facultyApproved?: boolean;
}

interface SettingsLoadFailureHandlers {
  onPendingApproval: () => void;
  onError: () => void;
}

function handleSettingsLoadFailure(
  err: unknown,
  handlers: SettingsLoadFailureHandlers,
) {
  const ax = err as AxiosError<{ code?: string; error?: string }>;
  if (
    ax.response?.status === 403 &&
    ax.response?.data?.code === FACULTY_PENDING_APPROVAL_CODE
  ) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    handlers.onPendingApproval();
    return;
  }

  handlers.onError();
}

function AccountSettings({
  user,
  onBack,
  onSignOut,
}: {
  user: User | null;
  onBack: () => void;
  onSignOut: () => void;
}) {
  return (
    <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-800">
      <div className="flex items-center gap-4 border-b border-primary/10 pb-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/30 text-xl font-black text-primary">
          {user?.name?.[0]?.toUpperCase() ?? "T"}
        </div>
        <div>
          <h2 className="text-xl font-black text-primary">
            {user?.name ?? "Teacher"}
          </h2>
          <p className="text-sm text-slate-500">{user?.email}</p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-background-light p-4 dark:bg-slate-900">
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Role
          </dt>
          <dd className="mt-1 font-bold text-primary">{user?.role}</dd>
        </div>
        <div className="rounded-xl bg-background-light p-4 dark:bg-slate-900">
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Faculty approval
          </dt>
          <dd className="mt-1 font-bold text-primary">
            {user?.facultyApproved ? "Approved" : "Pending"}
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={onBack}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90"
        >
          Back to dashboard
        </button>
        <button
          onClick={onSignOut}
          className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
        >
          Sign out
        </button>
      </div>
    </section>
  );
}

export default function TeacherSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/auth/teacher/login");
      return;
    }

    axios
      .get<User>(`${API_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.role !== REQUIRED_ROLE) {
          router.replace(getDashboardPathForRole(res.data.role));
          return;
        }
        setUser(res.data);
      })
      .catch((err) =>
        handleSettingsLoadFailure(err, {
          onPendingApproval: () =>
            router.replace("/auth/teacher/login?pending=1"),
          onError: () => setError("Failed to load settings."),
        }),
      )
      .finally(() => setLoading(false));
  }, [router]);

  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/auth/teacher/login");
  };

  return (
    <div className="min-h-screen bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <TeacherNavbar activePage="settings" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-primary">
            Settings
          </h1>
          <p className="mt-2 text-slate-500">
            View your teacher account details and session controls.
          </p>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-primary/10 bg-white p-8 text-center text-slate-500 dark:bg-slate-800">
            Loading settings...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-600">
            {error}
          </div>
        ) : (
          <AccountSettings
            user={user}
            onBack={() => router.push("/teacher/dashboard")}
            onSignOut={signOut}
          />
        )}
      </main>
    </div>
  );
}
