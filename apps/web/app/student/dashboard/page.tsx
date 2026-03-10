import { Lexend } from "next/font/google";

const lexend = Lexend({ subsets: ["latin"] });

export default function LabProctorDashboard() {
  return (
    <>
      {/* Material Symbols Import & Configuration */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
      `}</style>

      <div className={`${lexend.className} bg-[#F7F8F0] text-slate-900 min-h-screen`}>
        <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-[#355872]/10 bg-white px-6 md:px-10 py-4 sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3 text-[#355872]">
                <div className="size-8 bg-[#355872] rounded-lg flex items-center justify-center text-white">
                  <span className="material-symbols-outlined">biotech</span>
                </div>
                <h2 className="text-[#355872] text-xl font-bold tracking-tight">LabProctor</h2>
              </div>
              <nav className="hidden md:flex items-center gap-8">
                <a className="text-[#355872] font-semibold border-b-2 border-[#355872] pb-1 text-sm" href="#">
                  Dashboard
                </a>
                <a className="text-slate-500 hover:text-[#355872] transition-colors text-sm font-medium" href="#">
                  My Exams
                </a>
                <a className="text-slate-500 hover:text-[#355872] transition-colors text-sm font-medium" href="#">
                  History
                </a>
                <a className="text-slate-500 hover:text-[#355872] transition-colors text-sm font-medium" href="#">
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
                <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900">Alex Rivera</p>
                  <p className="text-[10px] text-slate-500">CS Senior</p>
                </div>
                <div className="size-10 rounded-full bg-[#7AAACE] flex items-center justify-center text-white border-2 border-white shadow-sm overflow-hidden">
                  {/* Note: Using standard <img> tag to avoid Next.js external domain config requirements */}
                  <img
                    className="w-full h-full object-cover"
                    alt="Portrait of a young male university student"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBlmKOuNY1wrhEgrRLZix_P88bhsSdapT5CgitWlh_qQ8M9NKdUuNYyQq9pPcYG7gwqzFscAvInI76VJOXfPIob1MWJkcU9gL9Hj0UVLgyAADPXqTNWdwIlM5zRHESXFPBhRHrrdRr7jiUXZVOxCNM_saDgkwZl7_L0Jp1JoH4isG66VEUZPt5f5r9tcXB0Q0kc82PnCOgWnNwiJpbZDBwxOfcbyf-x_vx7zPvy_XjUGhr7CFIw6AXtayE_uNZUFhlF5A1QOuv7RE2F"
                  />
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10">
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-[#355872] mb-2">Welcome back, Alex</h1>
              <p className="text-slate-600">
                You have <span className="font-semibold text-[#355872]">1 active exam</span> and 2 upcoming sessions this week.
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
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 animate-pulse">
                      In Progress
                    </span>
                  </div>
                  <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="p-6 md:flex gap-6">
                      <div className="md:w-1/3 mb-4 md:mb-0">
                        <div className="aspect-video md:aspect-square bg-slate-200 rounded-lg overflow-hidden relative">
                          <img
                            className="w-full h-full object-cover"
                            alt="Data structures and algorithms code on screen"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZ0UdWklF2P36jOk0V9IwsST_CVso7Oxxi5cfqMfyVTxRZxOiWzTepd0uVmn-H57CSvdJKUm0ZN7QiDdskd_4hoxnRvdx1YNVz4MdD0qTUi0Ifjy_lODJx4ITA4NYOR24y41XvNq5elR5SMBL_zAHfBCCqDIlwUovhRmnzlCBEW23pdTB_hjpIC_YuvM-2cvLkXzsaSLjQK0LR29EhLDrTZRFAvVvTg8gfYVZfPg_Eb28vfRGN9LJPqTSionsb5GcpidbQ04tyk7w2"
                          />
                          <div className="absolute inset-0 bg-[#355872]/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-4xl">code</span>
                          </div>
                        </div>
                      </div>
                      <div className="md:w-2/3 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-xl font-bold text-[#355872]">Advanced Data Structures (CS402)</h4>
                            <span className="text-sm font-medium text-slate-500">Room 4B</span>
                          </div>
                          <div className="space-y-2 mb-6">
                            <div className="flex items-center gap-2 text-slate-600 text-sm">
                              <span className="material-symbols-outlined text-base">person</span>
                              Proctor: Dr. Sarah Chen
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 text-sm">
                              <span className="material-symbols-outlined text-base">timer</span>
                              Duration: 120 Minutes (Ends 2:30 PM)
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 text-sm">
                              <span className="material-symbols-outlined text-base">shield</span>
                              Requirements: Webcam, Microphone, Screen Share
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <button className="bg-[#355872] text-white font-bold py-3 px-8 rounded-lg hover:bg-[#355872]/90 transition-all flex items-center gap-2 group flex-1 justify-center">
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
                </section>

                {/* Upcoming Exams Section */}
                <section>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#7AAACE]">calendar_month</span>
                    Upcoming This Week
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Exam Card 1 */}
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:border-[#7AAACE] transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div className="size-10 rounded bg-[#7AAACE]/10 text-[#7AAACE] flex items-center justify-center">
                          <span className="material-symbols-outlined">calculate</span>
                        </div>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase">
                          May 24, 10:00 AM
                        </span>
                      </div>
                      <h5 className="font-bold text-[#355872] mb-1">Discrete Mathematics</h5>
                      <p className="text-xs text-slate-500 mb-4">Midterm Assessment • 90 mins</p>
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          <div className="size-6 rounded-full border-2 border-white bg-slate-300 overflow-hidden">
                            <img
                              className="w-full h-full object-cover"
                              alt="Female professor profile thumbnail"
                              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZl5MRRWh-RlSg6f7V9yPctGpDieMFdhO7pSbpPVTBCyaWjDq0Hsi5Z216DBI3iMeGbJ8dy-yf_8tkCEe2_O58HbGkji4-_9E1R5crc22wMfhxGura4diqr-2gJwIXiKmj4VmOP36-R1RsTUiHTTkQEFWVvVEy1mDTmEQYP1wWIcS9FC86ctIXF5qey1mSL1pgrmU7s3xT7azTmI9S7gAWUj7fCPxIdez4jbkbKaTqdGtVXTykgzVbaUUUGtJGH2l7KxFvGYuqvTnL"
                            />
                          </div>
                        </div>
                        <button className="text-xs font-bold text-[#355872] hover:underline">View Guidelines</button>
                      </div>
                    </div>

                    {/* Exam Card 2 */}
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:border-[#7AAACE] transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div className="size-10 rounded bg-[#7AAACE]/10 text-[#7AAACE] flex items-center justify-center">
                          <span className="material-symbols-outlined">database</span>
                        </div>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase">
                          May 26, 2:00 PM
                        </span>
                      </div>
                      <h5 className="font-bold text-[#355872] mb-1">Database Systems</h5>
                      <p className="text-xs text-slate-500 mb-4">Quiz 3: Normalization • 45 mins</p>
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          <div className="size-6 rounded-full border-2 border-white bg-slate-300 overflow-hidden">
                            <img
                              className="w-full h-full object-cover"
                              alt="Male professor profile thumbnail"
                              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHq0G0mV10jK8FR5K-dhrrBamEBwx2k_sQqSjVTR5RH-Mjzf7A-YH6XovIfkO30_jjtwxWt_EnCXubGWWU29wAgMHKHuhphCdr7MUyQ94roY9C-YrjZA0-NjTDFLvW_hYw20Z2kxwkZNf6Y8WadCAMujho2eJwAqfcAf-0Vw8n8wf3spgwdlU9ZLGch4WzXv1W0BWZ6lcJD1dYHiwS_wUHkhWin92koq4epSlQOCZLLJ6zhWPyBG-VhZc-CNvjVBnftJQgH1XbNeUU"
                            />
                          </div>
                        </div>
                        <button className="text-xs font-bold text-[#355872] hover:underline">View Guidelines</button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Sidebar */}
              <div className="space-y-8">
                
                {/* System Readiness */}
                <section className="bg-[#355872] text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold mb-4">System Readiness</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[#9CD5FF]">videocam</span>
                          <span className="text-sm font-medium">Camera</span>
                        </div>
                        <span className="material-symbols-outlined text-green-400">check_circle</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[#9CD5FF]">mic</span>
                          <span className="text-sm font-medium">Microphone</span>
                        </div>
                        <span className="material-symbols-outlined text-green-400">check_circle</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[#9CD5FF]">wifi</span>
                          <span className="text-sm font-medium">Network</span>
                        </div>
                        <span className="text-xs font-bold bg-green-400 text-[#355872] px-2 py-0.5 rounded-full">
                          Stable
                        </span>
                      </div>
                    </div>
                    <button className="mt-6 w-full py-2 bg-[#9CD5FF] text-[#355872] font-bold rounded-lg hover:bg-white transition-colors text-sm">
                      Run Diagnostics
                    </button>
                  </div>
                  <div className="absolute -bottom-10 -right-10 size-40 bg-[#7AAACE]/10 rounded-full blur-2xl"></div>
                </section>

                {/* Recent Results */}
                <section className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Results</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <div>
                        <p className="text-sm font-bold text-[#355872] group-hover:underline">OS Architecture</p>
                        <p className="text-[10px] text-slate-500 italic">Submitted May 12</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">92/100</p>
                        <p className="text-[10px] text-green-500 font-bold">PASS</p>
                      </div>
                    </div>
                    <hr className="border-slate-50" />
                    <div className="flex items-center justify-between group cursor-pointer">
                      <div>
                        <p className="text-sm font-bold text-[#355872] group-hover:underline">Network Security</p>
                        <p className="text-[10px] text-slate-500 italic">Submitted May 08</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">88/100</p>
                        <p className="text-[10px] text-green-500 font-bold">PASS</p>
                      </div>
                    </div>
                  </div>
                  <button className="mt-6 w-full py-2 text-[#355872] font-bold border-2 border-[#355872]/20 rounded-lg hover:bg-[#355872]/5 transition-colors text-xs">
                    View All Results
                  </button>
                </section>

                {/* Proctor Tip */}
                <section className="bg-[#9CD5FF]/10 p-6 rounded-xl border border-[#9CD5FF]/20">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-[#355872]">info</span>
                    <h4 className="font-bold text-[#355872]">Proctor Tip</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ensure your room is well-lit and your desk is clear of any unauthorized materials before starting
                    your session.
                  </p>
                </section>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-100 py-8 mt-12">
            <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 opacity-60">
                <span className="material-symbols-outlined text-[#355872] text-xl">biotech</span>
                <span className="text-sm font-bold text-[#355872]">LabProctor v2.4.0</span>
              </div>
              <div className="flex gap-6 text-xs font-medium text-slate-500">
                <a className="hover:text-[#355872] transition-colors" href="#">
                  Privacy Policy
                </a>
                <a className="hover:text-[#355872] transition-colors" href="#">
                  Terms of Service
                </a>
                <a className="hover:text-[#355872] transition-colors" href="#">
                  Honor Code
                </a>
              </div>
              <div className="text-xs text-slate-400">© 2024 LabProctor Systems Inc.</div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}