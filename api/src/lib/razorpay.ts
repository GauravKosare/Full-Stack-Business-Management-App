import Razorpay from "razorpay";

export const isRazorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

// The Razorpay SDK throws synchronously if key_id/key_secret are missing, which would
// crash the whole process at import time (same failure mode passport-google-oauth20 had)
// before Razorpay env vars are configured — e.g. right after a fresh deploy. Construct
// lazily instead, only once a route handler actually needs it.
let razorpayClient: Razorpay | null = null;
export function getRazorpay(): Razorpay {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return razorpayClient;
}
