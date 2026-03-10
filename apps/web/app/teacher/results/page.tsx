import React from "react";
import { Lexend } from "next/font/google";

// Optimize font loading with Next.js
const lexend = Lexend({ subsets: ["latin"] });

export default function ProctoringDashboard() {
  return (
    <div className={`min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 ${lexend.className}`}>
      {/* Material Symbols Import */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
        {/* Top Navigation Bar */}
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
              <a className="text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-accent text-sm font-medium transition-colors" href="#">
                Dashboard
              </a>
              <a className="text-primary dark:text-accent text-sm font-bold border-b-2 border-primary dark:border-accent pb-1" href="#">
                Exams
              </a>
              <a className="text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-accent text-sm font-medium transition-colors" href="#">
                Reports
              </a>
              <a className="text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-accent text-sm font-medium transition-colors" href="#">
                Settings
              </a>
            </nav>
          </div>
          <div className="flex flex-1 justify-end gap-4 items-center">
            <div className="hidden md:flex items-center bg-primary/5 dark:bg-white/5 rounded-lg px-3 py-1.5 border border-primary/10">
              <span className="material-symbols-outlined text-slate-400 text-xl">
                search
              </span>
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-48 placeholder:text-slate-400"
                placeholder="Search students..."
                type="text"
              />
            </div>
            <button className="relative p-2 text-slate-600 hover:bg-primary/5 rounded-full transition-colors">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-red-500"></span>
            </button>
            <div
              className="h-10 w-10 rounded-full border-2 border-primary/20 bg-cover bg-center overflow-hidden"
              data-alt="User profile avatar of a faculty member"
              style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA81XrNspiSbAx7fqfNyRMPLDcvLlXGFR7mmpjNdMLlm2viLHOyl4DvwY_NhGdv_ReBDooIkWEDTzPWvY-c2N1YI-tEnUdxevGrAQS6U_CW4W0i4MPjhY4xrtOwSHRcl621Bb14oNyh_egK8DEEW5BJYQgiFNvjSwhLM-jvpb2QxAgx8Q2GwEIunGmUkegdNTkjKlL57b3rAR9Nb3SIy9BuU5RbOfdqJeXN1IQXepgCD6iP9ZtNjOEZCUexQ9l8JS62B46Gy-4MfoQS")' }}
            ></div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <a className="hover:text-primary flex items-center gap-1" href="#">
              <span className="material-symbols-outlined text-base">home</span>
              Dashboard
            </a>
            <span className="material-symbols-outlined text-xs">
              chevron_right
            </span>
            <a className="hover:text-primary" href="#">
              Exams
            </a>
            <span className="material-symbols-outlined text-xs">
              chevron_right
            </span>
            <span className="text-primary font-semibold">
              Mid-Semester IT302 Results
            </span>
          </nav>

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Exam Results & Leaderboard
              </h1>
              <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">school</span>
                Department of Information Technology, NITK Surathkal
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-primary/10 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-lg">
                  download
                </span>
                Export CSV
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-lg">share</span>
                Publish Results
              </button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-primary/10 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  Average Score
                </p>
                <span className="p-2 bg-secondary/10 text-secondary rounded-lg">
                  <span className="material-symbols-outlined">analytics</span>
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                74.2<span className="text-lg text-slate-400">/100</span>
              </p>
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-xs">
                  trending_up
                </span>
                +4.5% from last year
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-primary/10 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  Highest Marks
                </p>
                <span className="p-2 bg-accent/10 text-primary rounded-lg">
                  <span className="material-symbols-outlined">emoji_events</span>
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                98.5<span className="text-lg text-slate-400">/100</span>
              </p>
              <p className="text-xs text-slate-400 mt-2">Achieved by 2 students</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-primary/10 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  Participants
                </p>
                <span className="p-2 bg-primary/10 text-primary rounded-lg">
                  <span className="material-symbols-outlined">groups</span>
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                124
              </p>
              <p className="text-xs text-slate-400 mt-2">98% attendance rate</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-primary/10 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  Flagged Sessions
                </p>
                <span className="p-2 bg-red-100 text-red-600 rounded-lg">
                  <span className="material-symbols-outlined">warning</span>
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                03
              </p>
              <p className="text-xs text-red-600 mt-2 font-semibold">
                Requires manual review
              </p>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Leaderboard Table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    leaderboard
                  </span>
                  Top Performers
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>Filter by:</span>
                  <select className="bg-transparent border-none py-0 focus:ring-0 font-semibold text-primary cursor-pointer">
                    <option>Score (High to Low)</option>
                    <option>Time Taken</option>
                    <option>Roll Number</option>
                  </select>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-primary/10 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                        <th className="px-6 py-4">Rank</th>
                        <th className="px-6 py-4">Student Name</th>
                        <th className="px-6 py-4 text-center">Score</th>
                        <th className="px-6 py-4">Time Taken</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      <tr className="hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-400/20 text-yellow-700 font-bold text-sm">
                            1
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                              AA
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">
                                Aditi Agarwal
                              </p>
                              <p className="text-xs text-slate-400 italic">
                                211IT102
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-bold text-primary">98.5</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            42m 15s
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary hover:text-secondary font-bold text-sm">
                            Details
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-300/30 text-slate-600 font-bold text-sm">
                            2
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                              RK
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">
                                Rahul Kumar
                              </p>
                              <p className="text-xs text-slate-400 italic">
                                211IT145
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-bold text-primary">97.0</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            38m 40s
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary hover:text-secondary font-bold text-sm">
                            Details
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-orange-200/30 text-orange-700 font-bold text-sm">
                            3
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                              SM
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">
                                Sneha Murthy
                              </p>
                              <p className="text-xs text-slate-400 italic">
                                211IT156
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-bold text-primary">96.5</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            45m 02s
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary hover:text-secondary font-bold text-sm">
                            Details
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center h-8 w-8 text-slate-500 font-bold text-sm">
                            4
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                              VJ
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">
                                Vikram Jha
                              </p>
                              <p className="text-xs text-slate-400 italic">
                                211IT189
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-bold text-primary">94.0</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            51m 12s
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary hover:text-secondary font-bold text-sm">
                            Details
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 text-center">
                  <button className="text-primary text-sm font-bold hover:underline">
                    View All Students
                  </button>
                </div>
              </div>
            </div>

            {/* Marks Distribution & Summary */}
            <div className="space-y-6">
              <div className="bg-primary text-white rounded-xl p-6 shadow-xl shadow-primary/20 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">analytics</span>
                    Performance Summary
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-medium opacity-80">
                        <span>Excellent (&gt;90)</span>
                        <span>12 students</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-accent w-[10%] rounded-full"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-medium opacity-80">
                        <span>Good (75-90)</span>
                        <span>48 students</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-accent w-[38%] rounded-full"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-medium opacity-80">
                        <span>Average (50-75)</span>
                        <span>56 students</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-accent w-[45%] rounded-full"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-medium opacity-80">
                        <span>Below Average (&lt;50)</span>
                        <span>8 students</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-accent w-[7%] rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary opacity-20 -mr-10 -mt-10 rounded-full"></div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-primary/10 p-6 shadow-sm">
                <h3 className="text-slate-900 dark:text-white font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">
                    insights
                  </span>
                  Class Analytics
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-accent/10 text-primary rounded-lg">
                      <span className="material-symbols-outlined">timer</span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                        Avg. Completion Time
                      </p>
                      <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                        48m 22s
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-lg">
                      <span className="material-symbols-outlined">quiz</span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                        Toughest Question
                      </p>
                      <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                        Q. 14{" "}
                        <span className="text-sm font-normal text-slate-400">
                          (22% correct)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary/10 text-primary rounded-lg">
                      <span className="material-symbols-outlined">
                        fact_check
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                        Reliability Score
                      </p>
                      <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                        99.2%
                      </p>
                    </div>
                  </div>
                </div>
                <button className="w-full mt-6 py-2.5 bg-neutral-light text-primary font-bold rounded-lg border border-primary/10 hover:bg-primary/5 transition-colors">
                  Detailed Insights
                </button>
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-auto py-8 bg-white dark:bg-background-dark border-t border-primary/10 px-8 text-center md:text-left">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <p className="text-sm text-slate-500">
                © 2024 NITK Surathkal - Proctoring Management System
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                Designed by Department of Information Technology
              </p>
            </div>
            <div className="flex items-center gap-6">
              <a className="text-slate-400 hover:text-primary transition-colors" href="#">
                <span className="material-symbols-outlined">help</span>
              </a>
              <a className="text-slate-400 hover:text-primary transition-colors" href="#">
                <span className="material-symbols-outlined">policy</span>
              </a>
              <a className="text-slate-400 hover:text-primary transition-colors" href="#">
                <span className="material-symbols-outlined">contact_support</span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}