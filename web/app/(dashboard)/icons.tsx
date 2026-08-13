// Small stroke-based icon set for the sidebar — hand-authored rather than pulling in an
// icon library dependency for six glyphs.
export function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
      <rect x="13" y="10" width="7.5" height="10.5" rx="1.5" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function TasksIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M7.5 12l2.5 2.5 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TeamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M2.5 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="round" />
      <circle cx="16.5" cy="8.5" r="2.4" />
      <path d="M15 13.7c2.6.3 4.5 2.2 4.5 5.3" strokeLinecap="round" />
    </svg>
  );
}

export function BillingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 9.5h18" />
      <path d="M6.5 14.5h4" strokeLinecap="round" />
    </svg>
  );
}

export function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" strokeLinecap="round" />
    </svg>
  );
}

export function CollapseIcon({ className, collapsed }: { className?: string; collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M9.5 4v16" />
      {collapsed ? (
        <path d="M13.5 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M16.5 9l-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
