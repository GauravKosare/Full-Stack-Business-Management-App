-- Role enum is being replaced: owner/manager/employee/client -> owner/director/manager/
-- project_head/employee. Postgres can't drop an enum value in place, so the type is
-- recreated. Safe here because no "business_members" row currently uses "client"
-- (verified before writing this migration) — owner/manager/employee cast unchanged.
ALTER TYPE "Role" RENAME TO "Role_old";

CREATE TYPE "Role" AS ENUM ('owner', 'director', 'manager', 'project_head', 'employee');

ALTER TABLE "business_members"
  ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");

DROP TYPE "Role_old";

ALTER TABLE "business_members" ADD COLUMN "department" TEXT;
