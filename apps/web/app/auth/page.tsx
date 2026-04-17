import Link from "next/link";
import PublicHeader from "../components/PublicHeader";

export default function LabProctor() {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen">
      <div className="relative flex min-h-screen w-full flex-col group/design-root overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col">
          <PublicHeader />

          <main className="flex flex-1 justify-center items-center py-12 px-6">
            <div className="layout-content-container flex flex-col max-w-[1024px] flex-1">
              <div className="text-center mb-12">
                <h1 className="text-slate-900 dark:text-slate-100 text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
                  Welcome to the Future of Online Examination
                </h1>
                <p className="text-primary/70 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                  Secure, efficient, and transparent lab monitoring. Select your
                  role below to access your personalized workspace.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-[1320px] mx-auto w-full">
                <div className="group relative flex flex-col bg-white dark:bg-slate-800 p-8 rounded-xl border-2 border-transparent hover:border-accent-blue shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-light-blue/20 text-primary">
                    <span className="material-symbols-outlined text-4xl">
                      school
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    I am a Student
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                    Join active labs, submit your work, and view your
                    performance metrics in real-time.
                  </p>
                  <div className="mt-auto space-y-3">
                    <Link
                      href="/auth/student/login"
                      className="w-full flex items-center justify-center rounded-lg h-14 bg-primary text-white text-lg font-bold hover:bg-primary/90 transition-colors"
                    >
                      Student Login
                    </Link>
                    <Link
                      href="/auth/student/signup"
                      className="w-full flex items-center justify-center rounded-lg h-12 bg-cream text-primary text-sm font-bold hover:bg-light-blue/10 transition-colors"
                    >
                      Create Student Account
                    </Link>
                  </div>
                </div>

                <div className="group relative flex flex-col bg-white dark:bg-slate-800 p-8 rounded-xl border-2 border-transparent hover:border-accent-blue shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-accent-blue/20 text-primary">
                    <span className="material-symbols-outlined text-4xl">
                      person_book
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    I am a Teacher
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                    Create new lab sessions, monitor students, and manage
                    automated proctoring rules.
                  </p>
                  <div className="mt-auto space-y-3">
                    <Link
                      href="/auth/teacher/login"
                      className="w-full flex items-center justify-center rounded-lg h-14 bg-primary text-white text-lg font-bold hover:bg-primary/90 transition-colors"
                    >
                      Teacher Login
                    </Link>
                    <Link
                      href="/auth/teacher/signup"
                      className="w-full flex items-center justify-center rounded-lg h-12 bg-cream text-primary text-sm font-bold hover:bg-light-blue/10 transition-colors"
                    >
                      Register as Educator
                    </Link>
                  </div>
                </div>

                <div className="group relative flex flex-col bg-white dark:bg-slate-800 p-8 rounded-xl border-2 border-transparent hover:border-primary shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-4xl">
                      admin_panel_settings
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    I am an Admin
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                    Provision departments, manage academic structure, and
                    control access across the examination platform.
                  </p>
                  <div className="mt-auto space-y-3">
                    <Link
                      href="/auth/admin/login"
                      className="w-full flex items-center justify-center rounded-lg h-14 bg-primary text-white text-lg font-bold hover:bg-primary/90 transition-colors"
                    >
                      Admin Login
                    </Link>
                    <p className="rounded-lg border border-primary/10 bg-cream px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                      Admin accounts are provisioned by the system.
                    </p>
                  </div>
                </div>
              </div>

              {/* <div className="mt-20 @container">
                <div className="@[480px]:px-4 @[480px]:py-3">
                  <div
                    className="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end overflow-hidden @[480px]:rounded-xl min-h-[320px] relative"
                    data-alt="Modern high-tech laboratory with computer screens and equipment"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(53, 88, 114, 0.9), rgba(122, 170, 206, 0.4)), url("https://lh3.googleusercontent.com/aida-public/AB6AXuCXAKd3033MBQYj1_oOk7asp6nlJnxRcRoERY7xmAC8_fBCFtqySFUmSq0xId8Y78YCKDwydLPVQqrUds4ecxHBSsEZu-Rrq0lqYcjLcC8lwsoZ3fgNVwLy1uJXcfD79yVSGRPzuxkrOXK8g25fkaeePpkmAqCJkmCpCK9GGaUtESSd8G9emAKywLO47_Q3xZLxTABM-X6BIEqHbvdRW6UMhdbzSVi8XtNkswAU1wE1TFcnrAndZ0ZItIDXDNUvjD1IMjuqtqXe2w2I")',
                    }}
                  >
                    <div className="p-8 text-white max-w-lg">
                      <h4 className="text-2xl font-bold mb-2">
                        Trusted by 500+ Institutions
                      </h4>
                      <p className="text-white/80 text-sm">
                        LabProctor provides the industry's most reliable
                        automated supervision for remote and on-site practical
                        assessments.
                      </p>
                    </div>
                  </div>
                </div>
              </div> */}

              {/* <footer className="mt-16 border-t border-primary/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500 dark:text-slate-400 pb-12">
                <div className="flex gap-6">
                  <a className="hover:text-primary" href="#">
                    Privacy Policy
                  </a>
                  <a className="hover:text-primary" href="#">
                    Terms of Service
                  </a>
                  <a className="hover:text-primary" href="#">
                    System Status
                  </a>
                </div>
                <p>© 2024 LabProctor Inc. All rights reserved.</p>
              </footer> */}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
