// Shared left-hand branding panel for sign-in/login/sign-up — one visual identity across
// every entry point instead of three slightly different centered cards.
export function AuthMark({ className }: { className?: string }) {
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-card bg-primary text-white ${className ?? ""}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <path d="M7.5 12.5l2.8 2.8 6.2-6.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function AuthBrandPanel() {
  return (
    <div className="hidden flex-1 flex-col bg-primary p-12 text-white md:flex">
      <div className="flex items-center gap-3">
        <AuthMark className="bg-white/15" />
        <span className="text-lg font-semibold">Business Management App</span>
      </div>
      <div className="flex flex-1 items-center">
        <div className="max-w-md">
          <p className="text-[29px] leading-snug" style={{ textWrap: "balance" as const }}>
            Tasks, teams, and chat — organized around who's actually responsible for what.
          </p>
          <p className="mt-4 text-[18px] leading-relaxed text-white/70">
            Assign work down your reporting line, see it move in real time, and keep every
            department's conversation in one place.
          </p>
        </div>
      </div>
      <p className="text-xs text-white/50">© {new Date().getFullYear()} Business Management App</p>
    </div>
  );
}
