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
