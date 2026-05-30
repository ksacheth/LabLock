import Link from "next/link";
import PublicHeader from "./components/PublicHeader";

export default function NITKProctoringPage() {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <PublicHeader />

        <main className="flex flex-1 flex-col">
          <div className="px-6 md:px-20 py-12 md:py-24 pb-0">
            <div className="max-w-[1200px] mx-auto">
              <div className="flex flex-col gap-10 lg:flex-row items-center">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4">
                    <span className="text-secondary font-bold tracking-widest uppercase text-xs">
                      Integrity Redefined
                    </span>
                    <h1 className="text-primary text-4xl md:text-6xl font-black leading-tight tracking-tight">
                      Secure Online Examination for NITK Excellence
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl font-normal leading-relaxed max-w-[540px]">
                      Experience the next generation of academic integrity with
                      a centralised lab examination platform.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <Link
                      href="/auth"
                      className="flex min-w-[160px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 bg-primary text-white text-lg font-bold shadow-lg hover:translate-y-[-2px] transition-all"
                    >
                      Get Started
                    </Link>
                    {/* <button className="flex min-w-[160px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 bg-accent/20 text-primary text-lg font-bold hover:bg-accent/30 transition-all border border-accent/30">
                      Watch Demo
                    </button> */}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section id="solutions" className="px-6 md:px-20 py-16">
            <div className="max-w-[1200px] mx-auto grid gap-6 md:grid-cols-3">
              {[
                [
                  "Secure exam room",
                  "Fullscreen and tab-switch detection keep lab attempts accountable.",
                ],
                [
                  "Online compiler",
                  "Students write, run, and submit code from one locked workflow.",
                ],
                [
                  "Teacher controls",
                  "Faculty create exams, host sessions, and export results.",
                ],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-800"
                >
                  <h2 className="text-lg font-black text-primary">{title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="institutions" className="px-6 md:px-20 py-10">
            <div className="max-w-[1200px] mx-auto rounded-[2rem] border border-primary/10 bg-white p-8 dark:bg-slate-800 md:p-12">
              <h2 className="text-3xl font-black text-primary">
                Designed for campus labs
              </h2>
              <p className="mt-4 max-w-3xl text-slate-600 dark:text-slate-300">
                LabLock maps exams to departments and batches, so administrators
                can provision cohorts while faculty focus on question authoring
                and live assessment.
              </p>
            </div>
          </section>

          <section id="resources" className="px-6 md:px-20 py-10">
            <div className="max-w-[1200px] mx-auto grid gap-4 md:grid-cols-2">
              <Link
                href="/auth/teacher/login"
                className="rounded-2xl border border-primary/10 bg-white p-6 font-bold text-primary hover:bg-primary/5 dark:bg-slate-800"
              >
                Teacher login →
              </Link>
              <Link
                href="/auth/student/login"
                className="rounded-2xl border border-primary/10 bg-white p-6 font-bold text-primary hover:bg-primary/5 dark:bg-slate-800"
              >
                Student login →
              </Link>
            </div>
          </section>

          <div className="px-6 md:px-20 py-20">
            <div className="max-w-[1200px] mx-auto">
              <div className="relative overflow-hidden rounded-[2rem] bg-primary px-8 py-16 md:px-16 text-center text-white">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/20 rounded-full -ml-20 -mb-20 blur-3xl"></div>

                <div className="relative z-10 flex flex-col items-center gap-8">
                  <div className="flex flex-col gap-4">
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                      Ready to secure your next lab?
                    </h2>
                    <p className="text-accent text-lg md:text-xl max-w-[600px] mx-auto opacity-90">
                      Join the Department of Information Technology in setting
                      the benchmark for secure online assessments in engineering
                      education.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Link
                      href="/auth"
                      className="flex min-w-[200px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 bg-white text-primary text-lg font-bold hover:bg-background-light shadow-xl transition-all"
                    >
                      Create Free Account
                    </Link>
                    {/* <button className="flex min-w-[200px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 bg-primary border border-white/30 text-white text-lg font-bold hover:bg-white/10 transition-all">
                      Contact Sales
                    </button> */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
