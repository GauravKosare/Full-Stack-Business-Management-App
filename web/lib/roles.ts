// Mirrors api/src/lib/roles.ts — kept in sync by hand (see the fully-separate-codebases
// decision in docs/03-backend-schema.md). Lower number = more senior.
export const ROLE_RANK: Record<string, number> = {
  owner: 0,
  director: 1,
  manager: 2,
  project_head: 3,
  employee: 4,
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  director: "Director",
  manager: "Manager",
  project_head: "Project Head",
  employee: "Employee",
};

export const INVITABLE_ROLES = ["director", "manager", "project_head", "employee"] as const;

export const STAFF_MANAGING_ROLES = ["owner", "director", "manager", "project_head"];

export function outranks(actor: string | null, target: string): boolean {
  if (!actor) return false;
  return (ROLE_RANK[actor] ?? Infinity) < (ROLE_RANK[target] ?? -Infinity);
}

export function isStaffManaging(role: string | null): boolean {
  return role !== null && STAFF_MANAGING_ROLES.includes(role);
}

// Roles `actor` is allowed to invite/assign into — strictly below their own rank.
export function assignableRolesFor(actor: string | null): string[] {
  return INVITABLE_ROLES.filter((role) => outranks(actor, role));
}
