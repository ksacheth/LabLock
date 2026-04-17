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
                      Experience the next generation of academic integrity with centeralised lab Examinator website.
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
                    <button className="flex min-w-[200px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 bg-white text-primary text-lg font-bold hover:bg-background-light shadow-xl transition-all">
                      Create Free Account
                    </button>
                    {/* <button className="flex min-w-[200px] cursor-pointer items-center justify-center rounded-xl h-14 px-8 bg-primary border border-white/30 text-white text-lg font-bold hover:bg-white/10 transition-all">
                      Contact Sales
                    </button> */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* <footer className="bg-white dark:bg-background-dark border-t border-primary/5 px-6 md:px-20 py-12">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined"></span>
                <h2 className="text-xl font-bold">NITK Surathkal</h2>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                National Institute of Technology Karnataka, Surathkal.
                Department of Information Technology Proctoring Initiative.
              </p>
            </div>
            <div>
              <h4 className="text-primary font-bold mb-6">Product</h4>
              <ul className="flex flex-col gap-4 text-slate-500 text-sm">
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    AI Monitoring
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    Live Proctoring
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    Enterprise
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-primary font-bold mb-6">Department</h4>
              <ul className="flex flex-col gap-4 text-slate-500 text-sm">
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    Case Studies
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    Implementation
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    Security
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-primary font-bold mb-6">Support</h4>
              <ul className="flex flex-col gap-4 text-slate-500 text-sm">
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    API Docs
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-primary transition-colors"
                  >
                    Status
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="max-w-[1200px] mx-auto mt-12 pt-8 border-t border-primary/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-xs">
              © 2024 National Institute of Technology Karnataka. All rights
              reserved.
            </p>
            <div className="flex gap-6">
              <Link
                href="#"
                className="text-slate-400 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-xl">
                  language
                </span>
              </Link>
              <Link
                href="#"
                className="text-slate-400 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-xl">share</span>
              </Link>
            </div>
          </div>
        </footer> */}
      </div>
    </div>
  );
}
