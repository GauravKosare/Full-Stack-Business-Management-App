const BUSINESS_ID_KEY = "bma_business_id";
const BUSINESS_ROLE_KEY = "bma_business_role";

export function getActiveBusinessId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BUSINESS_ID_KEY);
}

export function getActiveBusinessRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BUSINESS_ROLE_KEY);
}

export function setActiveBusiness(id: string, role: string) {
  localStorage.setItem(BUSINESS_ID_KEY, id);
  localStorage.setItem(BUSINESS_ROLE_KEY, role);
}

export function clearActiveBusiness() {
  localStorage.removeItem(BUSINESS_ID_KEY);
  localStorage.removeItem(BUSINESS_ROLE_KEY);
}

// Several pages (layout header, profile) independently fetch the same business record
// on every navigation. Caching it (session-only — cleared on tab close, always
// revalidated in the background) lets the name/logo paint instantly from the last known
// value instead of showing "Loading…" every single time, while a fresh fetch still runs
// underneath to catch renames.
function businessCacheKey(id: string) {
  return `bma_business_cache_${id}`;
}

export function getCachedBusinessName(id: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(businessCacheKey(id));
}

export function setCachedBusinessName(id: string, name: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(businessCacheKey(id), name);
}
