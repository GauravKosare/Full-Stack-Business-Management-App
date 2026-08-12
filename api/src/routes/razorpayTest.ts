import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { getRazorpay, isRazorpayConfigured } from "../lib/razorpay";

/**
 * Standalone Razorpay Standard Checkout connectivity test — NOT the production billing
 * flow (see routes/billing.ts, which uses Razorpay Subscriptions for real plan billing).
 * This exists to verify RAZORPAY_KEY_ID/KEY_SECRET work end-to-end via a one-time test
 * order + signature verification. Deliberately left unauthenticated for low-friction
 * manual testing with test-mode keys — remove or gate behind auth before any real use.
 */
export const razorpayTestRouter = Router();

razorpayTestRouter.post("/create-order", async (req: Request, res: Response) => {
  if (!isRazorpayConfigured) {
    return res.status(401).json({ error: { code: "not_configured", message: "Razorpay is not configured" } });
  }

  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount < 100) {
    return res
      .status(400)
      .json({ error: { code: "bad_request", message: "amount must be an integer >= 100 (paise)" } });
  }

  try {
    const order = await getRazorpay().orders.create({
      amount,
      currency: "INR",
      receipt: `test_${Date.now()}`,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    res.status(500).json({ error: { code: "razorpay_error", message: (err as Error).message } });
  }
});

razorpayTestRouter.post("/verify-payment", (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res
      .status(400)
      .json({ error: { code: "bad_request", message: "Missing order id, payment id, or signature" } });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(401).json({ error: { code: "not_configured", message: "Razorpay is not configured" } });
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const signature = razorpay_signature as string;
  const verified =
    expectedSignature.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));

  if (!verified) {
    return res.status(400).json({ error: { code: "signature_mismatch", message: "Payment signature verification failed" } });
  }

  res.json({ verified: true, orderId: razorpay_order_id, paymentId: razorpay_payment_id });
});
