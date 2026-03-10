import React from 'react';
import { Lexend } from 'next/font/google';

// Optimize font loading using Next.js built-in Google Fonts
const lexend = Lexend({ 
  subsets: ['latin'],
  display: 'swap',
});

export default function ExamPortalDashboard() {
  return (
    <div className={`${lexend.className} bg-[#f6f7f7] dark:bg-[#16191c] text-slate-900 dark:text-slate-100 min-h-screen`}>
      {/* Import Material Symbols */}
      <link 
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" 
        rel="stylesheet" 
      />

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

      <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row min-h-[calc(100vh-64px)]">
        
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-80 border-r border-[#385571]/10 bg-white dark:bg-[#16191c] p-6 flex flex-col gap-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div>
            <h3 className="text-[#385571] text-xs font-bold uppercase tracking-wider mb-4">Exam Navigation</h3>
            <nav className="flex flex-col gap-1">
              <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:bg-[#385571]/5 transition-all group" href="#">
                <span className="material-symbols-outlined text-slate-400 group-hover:text-[#385571]">settings</span>
                <span className="text-sm font-medium">Exam Settings</span>
              </a>
              
              <div className="my-2 border-t border-[#385571]/5"></div>
              
              <div className="flex items-center justify-between px-3 py-2 mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Questions</span>
                <span className="bg-[#385571]/10 text-[#385571] text-[10px] px-2 py-0.5 rounded-full font-bold tracking-tighter">03/05</span>
              </div>
              
              {/* Question List/Stepper */}
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#385571]/5 text-[#385571] border-l-4 border-[#385571]">
                  <span className="text-xs font-bold">01</span>
                  <span className="text-sm font-semibold truncate">Two Sum Logic</span>
                  <span className="material-symbols-outlined text-xs ml-auto text-green-500">check_circle</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-[#385571]/5 transition-all">
                  <span className="text-xs font-bold">02</span>
                  <span className="text-sm font-medium truncate">Binary Tree In-order</span>
                  <span className="material-symbols-outlined text-xs ml-auto text-green-500">check_circle</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#385571] text-white shadow-lg shadow-[#385571]/20">
                  <span className="text-xs font-bold">03</span>
                  <span className="text-sm font-medium truncate">Dynamic Knapsack</span>
                  <span className="material-symbols-outlined text-xs ml-auto">edit</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 opacity-60 cursor-not-allowed">
                  <span className="text-xs font-bold">04</span>
                  <span className="text-sm font-medium truncate">New Question</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 opacity-60 cursor-not-allowed">
                  <span className="text-xs font-bold">05</span>
                  <span className="text-sm font-medium truncate">New Question</span>
                </button>
              </div>
            </nav>
          </div>
          
          <div className="mt-auto">
            <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-[#385571]/30 text-[#385571] font-bold text-sm hover:bg-[#385571]/5 transition-colors">
              <span className="material-symbols-outlined">add</span>
              Add Question Slot
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 lg:p-12 max-w-4xl mx-auto w-full">
          <div className="flex flex-col gap-8">
            
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <nav className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-2">
                  <span>Exams</span>
                  <span className="material-symbols-outlined text-xs">chevron_right</span>
                  <span>Create New</span>
                </nav>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Question 3: Problem Definition</h1>
              </div>
              <div className="flex gap-3">
                <button className="px-6 py-2.5 rounded-lg border border-[#385571]/20 text-[#385571] font-bold text-sm hover:bg-[#385571]/5 transition-colors">
                  Save Draft
                </button>
                <button className="px-6 py-2.5 rounded-lg bg-[#385571] text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-[#385571]/20">
                  Publish Exam
                </button>
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-white dark:bg-[#16191c] rounded-2xl border border-[#385571]/10 shadow-sm overflow-hidden">
              <div className="p-6 md:p-8 space-y-8">
                
                {/* Question Title */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Question Title</label>
                  <input 
                    className="w-full px-4 py-3 rounded-lg border border-[#385571]/10 bg-[#f6f7f7] dark:bg-slate-800 focus:ring-2 focus:ring-[#385571] focus:border-transparent transition-all outline-none font-medium" 
                    placeholder="e.g., Implement a 0/1 Knapsack algorithm" 
                    type="text" 
                  />
                </div>

                {/* Question Description (Rich Text Simulation) */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Problem Description</label>
                  <div className="border border-[#385571]/10 rounded-lg overflow-hidden bg-[#f6f7f7] dark:bg-slate-800">
                    <div className="flex items-center gap-1 p-2 border-b border-[#385571]/5 bg-white/50 dark:bg-slate-900/50">
                      <button className="p-1.5 hover:bg-[#385571]/10 rounded"><span className="material-symbols-outlined text-sm">format_bold</span></button>
                      <button className="p-1.5 hover:bg-[#385571]/10 rounded"><span className="material-symbols-outlined text-sm">format_italic</span></button>
                      <button className="p-1.5 hover:bg-[#385571]/10 rounded"><span className="material-symbols-outlined text-sm">format_list_bulleted</span></button>
                      <button className="p-1.5 hover:bg-[#385571]/10 rounded"><span className="material-symbols-outlined text-sm">code</span></button>
                      <button className="p-1.5 hover:bg-[#385571]/10 rounded"><span className="material-symbols-outlined text-sm">image</span></button>
                    </div>
                    <textarea 
                      className="w-full p-4 bg-transparent border-none focus:ring-0 outline-none resize-none text-sm leading-relaxed" 
                      placeholder="Enter problem statement, constraints, and examples..." 
                      rows={8}
                    />
                  </div>
                </div>

                {/* Test Cases Section */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between border-b border-[#385571]/10 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Test Cases</h3>
                      <p className="text-xs font-medium text-slate-500">Provide at least 3 test cases for comprehensive grading</p>
                    </div>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#7AAACE]/10 text-[#385571] font-bold text-xs hover:bg-[#7AAACE]/20 transition-colors">
                      <span className="material-symbols-outlined text-base">add_box</span>
                      Add New Case
                    </button>
                  </div>

                  {/* Test Case Block 1 */}
                  <div className="p-5 rounded-xl border border-[#385571]/10 bg-[#f6f7f7] dark:bg-slate-800/50 space-y-4 relative group">
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button className="text-slate-400 hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-[#385571] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Test Case 1</span>
                      <span className="text-xs text-slate-500 font-medium">Public</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Custom Input</label>
                        <textarea 
                          className="w-full p-3 rounded-lg border border-[#385571]/10 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-[#385571] outline-none text-sm font-mono" 
                          placeholder="Input values..." 
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Expected Output</label>
                        <textarea 
                          className="w-full p-3 rounded-lg border border-[#385571]/10 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-[#385571] outline-none text-sm font-mono" 
                          placeholder="Output values..." 
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Test Case Block 2 */}
                  <div className="p-5 rounded-xl border border-[#385571]/10 bg-[#f6f7f7] dark:bg-slate-800/50 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Test Case 2</span>
                      <span className="text-xs text-slate-500 font-medium">Hidden</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Custom Input</label>
                        <textarea 
                          className="w-full p-3 rounded-lg border border-[#385571]/10 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-[#385571] outline-none text-sm font-mono" 
                          placeholder="Input values..." 
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Expected Output</label>
                        <textarea 
                          className="w-full p-3 rounded-lg border border-[#385571]/10 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-[#385571] outline-none text-sm font-mono" 
                          placeholder="Output values..." 
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="bg-[#385571]/5 p-6 border-t border-[#385571]/10 flex justify-between items-center">
                <button className="flex items-center gap-2 text-[#385571] font-bold text-sm">
                  <span className="material-symbols-outlined">chevron_left</span>
                  Previous Question
                </button>
                <button className="flex items-center gap-2 bg-[#385571] text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-md shadow-[#385571]/10">
                  Save & Next Question
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Guidance Note */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl flex gap-4">
              <span className="material-symbols-outlined text-blue-500">info</span>
              <div>
                <p className="text-sm font-bold text-blue-900 dark:text-blue-100">Pro-tip for NITK Instructors</p>
                <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                  Make sure to include constraints on time and space complexity in the description for automated evaluation.
                </p>
              </div>
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
}