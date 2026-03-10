"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TeacherNavbar({ activePage }: { activePage: "dashboard" | "exams" | "reports" | "settings" }) {
  const router = useRouter();

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/auth/teacher/login");
  };

  const navItems = [
    { label: "Dashboard", href: "/teacher/dashboard", key: "dashboard" },
    { label: "Exams", href: "/teacher/exams", key: "exams" },
    { label: "Reports", href: "/teacher/results", key: "reports" },
    { label: "Settings", href: "#", key: "settings" },
  ] as const;

  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-primary/10 bg-white dark:bg-background-dark px-6 md:px-10 py-3 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-4 text-primary">
          <div className="size-8 flex items-center justify-center bg-primary text-white rounded-lg">
            <span className="material-symbols-outlined">shield_person</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-primary text-lg font-bold leading-tight tracking-tight">
              NITK Proctoring
            </h2>
            <p className="text-[10px] uppercase tracking-widest font-semibold opacity-70">
              Dept. of IT
            </p>
          </div>
        </div>
        <nav className="hidden lg:flex items-center gap-9">
          {navItems.map((item) =>
            item.key === activePage ? (
              <Link
                key={item.key}
                href={item.href}
                className="text-primary dark:text-accent text-sm font-bold border-b-2 border-primary dark:border-accent pb-1"
              >
                {item.label}
              </Link>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                className="text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-accent text-sm font-medium transition-colors"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
      </div>
      <div className="flex flex-1 justify-end gap-4 items-center">
        <div className="hidden md:flex items-center bg-primary/5 dark:bg-white/5 rounded-lg px-3 py-1.5 border border-primary/10">
          <span className="material-symbols-outlined text-slate-400 text-xl">search</span>
          <input
            className="bg-transparent border-none focus:ring-0 text-sm w-48 placeholder:text-slate-400 outline-none"
            placeholder="Search students..."
            type="text"
          />
        </div>
        <button className="relative p-2 text-slate-600 hover:bg-primary/5 rounded-full transition-colors">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-red-500"></span>
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-100 dark:border-red-900/30"
          title="Sign Out"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          <span className="hidden md:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
