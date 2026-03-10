import Head from 'next/head';
import Link from "next/link";

export default function LabProctor() {
  return (
    <>
      <Head>
        <title>LabProctor - Select Your Role</title>
        <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </Head>

      <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen">
        <div className="relative flex min-h-screen w-full flex-col group/design-root overflow-x-hidden">
          <div className="layout-container flex h-full grow flex-col">
            <header className="flex items-center justify-between border-b border-primary/10 px-6 md:px-20 py-4 bg-background-light/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-3 text-primary">
                  <span className="material-symbols-outlined text-3xl"></span>
                  <h2 className="text-xl font-bold leading-tight tracking-tight">NITK Proctoring</h2>
                </div>
                <div className="hidden md:flex flex-1 justify-center gap-8">
                  <Link href="#" className="text-primary/80 hover:text-primary text-sm font-medium transition-colors">Solutions</Link>
                  <Link href="#" className="text-primary/80 hover:text-primary text-sm font-medium transition-colors">Institutions</Link>
                  <Link href="#" className="text-primary/80 hover:text-primary text-sm font-medium transition-colors">Pricing</Link>
                  <Link href="#" className="text-primary/80 hover:text-primary text-sm font-medium transition-colors">Resources</Link>
                </div>
                <div className="flex gap-3">
                  <button className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-10 px-5 bg-transparent border border-primary text-primary text-sm font-bold hover:bg-primary/5 transition-all">
                    <span>Login</span>
                  </button>
                  <button className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-10 px-5 bg-primary text-white text-sm font-bold hover:bg-primary/90 shadow-md transition-all">
                    <span>Sign Up</span>
                  </button>
                </div>
              </header>

            <main className="flex flex-1 justify-center items-center py-12 px-6">
              <div className="layout-content-container flex flex-col max-w-[1024px] flex-1">
                <div className="text-center mb-12">
                  <h1 className="text-slate-900 dark:text-slate-100 text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
                    Welcome to the Future of Proctoring
                  </h1>
                  <p className="text-primary/70 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                    Secure, efficient, and transparent lab monitoring. Select your role below to access your personalized workspace.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[860px] mx-auto w-full">
                  <div className="group relative flex flex-col bg-white dark:bg-slate-800 p-8 rounded-xl border-2 border-transparent hover:border-accent-blue shadow-sm hover:shadow-xl transition-all duration-300">
                    <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-light-blue/20 text-primary">
                      <span className="material-symbols-outlined text-4xl"></span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">I am a Student</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                      Join active labs, submit your work, and view your performance metrics in real-time.
                    </p>
                    <div className="mt-auto space-y-3">
                      <button className="w-full flex items-center justify-center rounded-lg h-14 bg-primary text-white text-lg font-bold hover:bg-primary/90 transition-colors">
                        Student Login
                      </button>
                      <button className="w-full flex items-center justify-center rounded-lg h-12 bg-cream text-primary text-sm font-bold hover:bg-light-blue/10 transition-colors">
                        Create Student Account
                      </button>
                    </div>
                  </div>

                  <div className="group relative flex flex-col bg-white dark:bg-slate-800 p-8 rounded-xl border-2 border-transparent hover:border-accent-blue shadow-sm hover:shadow-xl transition-all duration-300">
                    <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-accent-blue/20 text-primary">
                      <span className="material-symbols-outlined text-4xl"></span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">I am a Teacher</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                      Create new lab sessions, monitor students, and manage automated proctoring rules.
                    </p>
                    <div className="mt-auto space-y-3">
                      <button className="w-full flex items-center justify-center rounded-lg h-14 bg-primary text-white text-lg font-bold hover:bg-primary/90 transition-colors">
                        Teacher Login
                      </button>
                      <button className="w-full flex items-center justify-center rounded-lg h-12 bg-cream text-primary text-sm font-bold hover:bg-light-blue/10 transition-colors">
                        Register as Educator
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-20 @container">
                  <div className="@[480px]:px-4 @[480px]:py-3">
                    <div
                      className="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end overflow-hidden @[480px]:rounded-xl min-h-[320px] relative"
                      data-alt="Modern high-tech laboratory with computer screens and equipment"
                      style={{
                        backgroundImage: 'linear-gradient(to right, rgba(53, 88, 114, 0.9), rgba(122, 170, 206, 0.4)), url("https://lh3.googleusercontent.com/aida-public/AB6AXuCXAKd3033MBQYj1_oOk7asp6nlJnxRcRoERY7xmAC8_fBCFtqySFUmSq0xId8Y78YCKDwydLPVQqrUds4ecxHBSsEZu-Rrq0lqYcjLcC8lwsoZ3fgNVwLy1uJXcfD79yVSGRPzuxkrOXK8g25fkaeePpkmAqCJkmCpCK9GGaUtESSd8G9emAKywLO47_Q3xZLxTABM-X6BIEqHbvdRW6UMhdbzSVi8XtNkswAU1wE1TFcnrAndZ0ZItIDXDNUvjD1IMjuqtqXe2w2I")'
                      }}
                    >
                      <div className="p-8 text-white max-w-lg">
                        <h4 className="text-2xl font-bold mb-2">Trusted by 500+ Institutions</h4>
                        <p className="text-white/80 text-sm">
                          LabProctor provides the industry's most reliable automated supervision for remote and on-site practical assessments.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="mt-16 border-t border-primary/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500 dark:text-slate-400 pb-12">
                  <div className="flex gap-6">
                    <a className="hover:text-primary" href="#">Privacy Policy</a>
                    <a className="hover:text-primary" href="#">Terms of Service</a>
                    <a className="hover:text-primary" href="#">System Status</a>
                  </div>
                  <p>© 2024 LabProctor Inc. All rights reserved.</p>
                </footer>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}