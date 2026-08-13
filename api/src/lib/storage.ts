import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isStorageConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

// Service-role client, server-only — never sent to the browser. The client only ever
// receives a short-lived signed URL scoped to one object, generated here.
const storageClient = isStorageConfigured ? createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!) : null;

export const PROOF_BUCKET = "task-proofs";
export const MAX_PROOF_FILE_BYTES = 5 * 1024 * 1024; // 5MB — matches the bucket's own file_size_limit (defense in depth)

// Allowlist, not a video blocklist — "pdf, docs, image, or other files, must not be
// video" is easiest to enforce correctly as an explicit allowlist, since a blocklist can
// never enumerate every video mime type (and some browsers/OSes report video files with
// generic types like application/octet-stream, which a blocklist would let through).
// Kept identical to the bucket's own allowed_mime_types for consistency — this check is
// the fast-fail path; the bucket-level restriction is the backstop.
export const ALLOWED_PROOF_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
]);

export function proofObjectPath(businessId: string, taskId: string, userId: string, fileName: string): string {
  // businessId in the path isn't load-bearing for access control (that's the JWT +
  // membership checks in the route), but it keeps objects browsable/groupable in the
  // Supabase dashboard if you ever need to look at storage usage per business.
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  return `${businessId}/${taskId}/${userId}-${Date.now()}-${safeName}`;
}

export async function createProofUploadUrl(path: string) {
  if (!storageClient) throw new Error("Storage not configured");
  const { data, error } = await storageClient.storage.from(PROOF_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return data; // { path, token, signedUrl }
}

export async function createProofDownloadUrl(path: string, expiresInSeconds = 60) {
  if (!storageClient) throw new Error("Storage not configured");
  const { data, error } = await storageClient.storage.from(PROOF_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
