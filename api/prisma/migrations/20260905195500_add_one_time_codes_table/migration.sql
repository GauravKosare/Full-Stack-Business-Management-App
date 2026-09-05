-- One-time OAuth exchange codes, moved out of an in-memory Map: the callback and the
-- exchange request are two separate HTTP requests that can land on two different
-- serverless function instances on Vercel, so an in-memory store on one instance is
-- invisible to the other, causing intermittent "invalid_code" failures. See
-- api/src/lib/oauthCodes.ts.
CREATE TABLE "one_time_codes" (
    "code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_codes_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "one_time_codes_expires_at_idx" ON "one_time_codes" ("expires_at");

ALTER TABLE "one_time_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "one_time_codes" FORCE ROW LEVEL SECURITY;
