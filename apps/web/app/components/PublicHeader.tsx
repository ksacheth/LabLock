import Link from "next/link";

export default function PublicHeader() {
  return (
    <header className="flex items-center justify-between border-b border-primary/10 px-6 md:px-20 py-4 bg-background-light/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-3 text-primary">
        <span className="material-symbols-outlined text-3xl">shield_person</span>
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
  );
}
