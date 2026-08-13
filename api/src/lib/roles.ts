import { Role } from "@prisma/client";

// Lower number = more senior. Owner is the implicit top (assigned only at business
// creation, never invited) — everything else forms a delegation chain: each role may
// invite and assign tasks to anyone strictly below it, never at or above its own rank.
export const ROLE_RANK: Record<Role, number> = {
  owner: 0,
  director: 1,
  manager: 2,
  project_head: 3,
  employee: 4,
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  director: "Director",
  manager: "Manager",
  project_head: "Project Head",
  employee: "Employee",
};

// Roles a business can actually invite someone into — "owner" is set once at business
// creation and is never a target of an invite.
export const INVITABLE_ROLES: Role[] = ["director", "manager", "project_head", "employee"];

// Roles that may create tasks and manage the team at all (anyone but the bottom rank).
export const STAFF_MANAGING_ROLES: Role[] = ["owner", "director", "manager", "project_head"];

// "Manager and above" — these roles see same-rank peers company-wide on the Team page,
// regardless of department, on top of the department-scoped visibility everyone gets.
export const PEER_VISIBILITY_ROLES: Role[] = ["owner", "director", "manager"];

export function outranks(actor: Role, target: Role): boolean {
  return ROLE_RANK[actor] < ROLE_RANK[target];
}

// What roles `actor` is allowed to invite/assign into — strictly below their own rank.
export function assignableRolesFor(actor: Role): Role[] {
  return INVITABLE_ROLES.filter((role) => outranks(actor, role));
}

// Chat channel creation is more permissive than invites/task assignment: same rank,
// anyone below, or exactly one rank above (e.g. a Manager can add a Director, but not
// an Owner, to a channel they're creating).
export function canAddToChannel(actor: Role, target: Role): boolean {
  return ROLE_RANK[target] >= ROLE_RANK[actor] - 1;
}
