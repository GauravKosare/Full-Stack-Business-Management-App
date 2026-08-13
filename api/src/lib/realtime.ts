import { logger } from "./logger";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isRealtimeConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

// Push a "new message" event to anyone with the channel open, over Supabase's Realtime
// Broadcast REST API — a single HTTP call, no websocket connection to maintain from a
// serverless function. This is purely a live-update nicety on top of the message
// already being durably saved via Prisma; a failed broadcast must never fail the send
// itself, so callers should await this but treat a thrown error as non-fatal.
export async function broadcastNewMessage(channelId: string, message: unknown): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn("Realtime not configured — skipping broadcast");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ topic: `channel:${channelId}`, event: "new_message", payload: { message } }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Realtime broadcast failed: ${res.status} ${body}`);
  }
}
