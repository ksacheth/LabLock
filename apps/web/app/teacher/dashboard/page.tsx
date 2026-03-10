import React from 'react';

export default function TeacherDashboard() {
  return (
    <>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <style>{`
          body { font-family: 'Lexend', sans-serif; }
          .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        `}</style>
      </head>

      <div className="flex h-screen overflow-hidden bg-[#F7F8F0] dark:bg-[#16191c] text-slate-900 dark:text-slate-100">
        {/* Sidebar Navigation */}
        <aside className="w-64 flex-shrink-0 border-r border-[#355872]/10 bg-white dark:bg-[#16191c] flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#355872] flex items-center justify-center text-white">
              <span className="material-symbols-outlined">shield_person</span>
            </div>
            <div>
              <h1 className="text-[#355872] font-bold text-lg leading-tight">Lab Proctor</h1>
              <p className="text-xs text-[#7AAACE] font-medium">Teacher Portal</p>
            </div>
          </div>
          <nav className="flex-1 px-4 space-y-1">
            <a className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#355872]/10 text-[#355872] font-medium" href="#">
              <span className="material-symbols-outlined">dashboard</span>
              <span>Dashboard</span>
            </a>
            <a className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#355872]/5 text-slate-600 dark:text-slate-400 font-medium" href="#">
              <span className="material-symbols-outlined">add_box</span>
              <span>Create Exam</span>
            </a>
            <a className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#355872]/5 text-slate-600 dark:text-slate-400 font-medium" href="#">
              <span className="material-symbols-outlined">description</span>
              <span>Drafts</span>
            </a>
            <a className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#355872]/5 text-slate-600 dark:text-slate-400 font-medium" href="#">
              <span className="material-symbols-outlined">podcasts</span>
              <span>Live Sessions</span>
            </a>
            <a className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#355872]/5 text-slate-600 dark:text-slate-400 font-medium" href="#">
              <span className="material-symbols-outlined">analytics</span>
              <span>Results</span>
            </a>
          </nav>
          <div className="p-4 border-t border-[#355872]/10">
            <a className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#355872]/5 text-slate-600 dark:text-slate-400 font-medium" href="#">
              <span className="material-symbols-outlined">settings</span>
              <span>Settings</span>
            </a>
            <div className="mt-4 flex items-center gap-3 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-[#7AAACE]/30 overflow-hidden">
                {/* Using a standard img tag for external profile pic to avoid Next.js external domain config requirements */}
                <img alt="Profile" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD3mjdbwbm74U2g9yQk0fBy5ZRzejAHhWGvMleclUwTxPOzHZn-Psp7pEps3H3t0vB3f0iL1_TldoO5RHXySEDAQXVwEklGoUTCyzQkaTmRm9JcvaSZTe-ZxuV5T1mxOKpj1FH0zzvpQ60yuWeUfMB9MKN6wSyQaApAsXa8H113zWK1p4OjnsOSOMrw-h5o2rMfZcRw9mDUnMaJARrwESuMrYrcLI7huxlqm945bQTmkRhi8euXUHdB8L6YUY3stvoq-o8zS1tCyg9w" />
              </div>
              <div className="text-sm">
                <p className="font-bold">Dr. Smith</p>
                <p className="text-xs text-slate-500">Computer Science</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#F7F8F0] dark:bg-[#16191c] p-8">
          {/* Header Section */}
          <header className="mb-8">
            <h2 className="text-3xl font-black text-[#355872] tracking-tight">Teacher Dashboard</h2>
            <p className="text-slate-500 mt-1">Manage your lab exams, questions, and active proctoring sessions.</p>
          </header>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#355872]/10 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500 text-sm font-medium">Total Exams</p>
                <span className="material-symbols-outlined text-[#7AAACE]">library_books</span>
              </div>
              <p className="text-3xl font-bold text-[#355872]">24</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#355872]/10 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500 text-sm font-medium">Active Sessions</p>
                <span className="material-symbols-outlined text-green-500">sensors</span>
              </div>
              <p className="text-3xl font-bold text-[#355872]">02</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#355872]/10 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500 text-sm font-medium">Drafts</p>
                <span className="material-symbols-outlined text-[#9CD5FF]">edit_note</span>
              </div>
              <p className="text-3xl font-bold text-[#355872]">08</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Exam Section */}
            <section className="bg-white dark:bg-slate-800 rounded-xl border border-[#355872]/10 shadow-md overflow-hidden flex flex-col">
              <div className="p-6 border-b border-[#355872]/5 bg-[#355872]/5">
                <h3 className="text-lg font-bold text-[#355872] flex items-center gap-2">
                  <span className="material-symbols-outlined">add_circle</span>
                  Create New Exam
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Exam Title</label>
                  <input
                    className="w-full rounded-lg border-[#355872]/20 bg-[#F7F8F0] dark:bg-slate-900 focus:ring-[#7AAACE] focus:border-[#7AAACE]"
                    placeholder="e.g. Data Structures Midterm"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Question Content</label>
                  <textarea
                    className="w-full rounded-lg border-[#355872]/20 bg-[#F7F8F0] dark:bg-slate-900 focus:ring-[#7AAACE] focus:border-[#7AAACE]"
                    placeholder="Type your programming problem statement here..."
                    rows={4}
                  ></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Input Test Case</label>
                    <input
                      className="w-full rounded-lg border-[#355872]/20 bg-[#F7F8F0] dark:bg-slate-900"
                      placeholder="Sample Input"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Expected Output</label>
                    <input
                      className="w-full rounded-lg border-[#355872]/20 bg-[#F7F8F0] dark:bg-slate-900"
                      placeholder="Sample Output"
                      type="text"
                    />
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-[#355872] hover:bg-[#355872]/90 text-white rounded-lg font-bold transition-all shadow-lg shadow-[#355872]/20">
                  <span className="material-symbols-outlined">save</span>
                  Save to Drafts
                </button>
              </div>
            </section>

            {/* Host Exam Section (Drafts) */}
            <section className="bg-white dark:bg-slate-800 rounded-xl border border-[#355872]/10 shadow-md overflow-hidden flex flex-col">
              <div className="p-6 border-b border-[#355872]/5 bg-[#7AAACE]/5">
                <h3 className="text-lg font-bold text-[#355872] flex items-center gap-2">
                  <span className="material-symbols-outlined">rocket_launch</span>
                  Host Exam (Drafts)
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-0">
                <div className="divide-y divide-[#355872]/5">
                  {/* Exam Row 1 */}
                  <div className="p-4 hover:bg-[#F7F8F0] dark:hover:bg-slate-900 flex items-center justify-between group transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-[#9CD5FF]/20 flex items-center justify-center text-[#355872] font-bold">
                        01
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">Intro to Python Lab 4</p>
                        <p className="text-xs text-slate-500">3 Questions • 15 Test cases • Created 2d ago</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-[#7AAACE] hover:bg-[#355872] text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                      Go Live
                    </button>
                  </div>

                  {/* Exam Row 2 */}
                  <div className="p-4 hover:bg-[#F7F8F0] dark:hover:bg-slate-900 flex items-center justify-between group transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-[#9CD5FF]/20 flex items-center justify-center text-[#355872] font-bold">
                        02
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">OS Systems Final</p>
                        <p className="text-xs text-slate-500">10 Questions • 50 Test cases • Created 5d ago</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-[#7AAACE] hover:bg-[#355872] text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                      Go Live
                    </button>
                  </div>

                  {/* Exam Row 3 */}
                  <div className="p-4 hover:bg-[#F7F8F0] dark:hover:bg-slate-900 flex items-center justify-between group transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-[#9CD5FF]/20 flex items-center justify-center text-[#355872] font-bold">
                        03
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">Web Dev Mini Project</p>
                        <p className="text-xs text-slate-500">1 Questions • 12 Test cases • Created 1w ago</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-[#7AAACE] hover:bg-[#355872] text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                      Go Live
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900 text-center border-t border-[#355872]/5">
                <button className="text-[#7AAACE] text-sm font-bold hover:underline">View all 8 drafts</button>
              </div>
            </section>
          </div>

          {/* Recent Activity */}
          <div className="mt-10">
            <h3 className="text-xl font-bold text-[#355872] mb-4 px-1">Active Proctored Sessions</h3>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#355872]/10 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#355872]/5 text-[#355872] text-sm uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4">Session Name</th>
                    <th className="px-6 py-4">Students</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Integrity Score</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#355872]/5">
                  <tr>
                    <td className="px-6 py-4 font-medium">CS101: Morning Batch</td>
                    <td className="px-6 py-4 text-slate-500">42 / 45 Active</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase">Live</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-slate-200 rounded-full h-2 max-w-[100px]">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '95%' }}></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-[#355872] font-bold text-sm hover:underline">View Feed</button>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium">Algo Design 202</td>
                    <td className="px-6 py-4 text-slate-500">28 / 30 Active</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase">Live</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-slate-200 rounded-full h-2 max-w-[100px]">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '72%' }}></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-[#355872] font-bold text-sm hover:underline">View Feed</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}