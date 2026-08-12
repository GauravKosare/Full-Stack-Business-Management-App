import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { Plan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { createNotification } from "../lib/notifications";
import { getRazorpay, isRazorpayConfigured } from "../lib/razorpay";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export const billingRouter = Router({ mergeParams: true });

const PLAN_IDS: Record<"pro" | "enterprise", string | undefined> = {
  pro: process.env.RAZORPAY_PLAN_PRO,
  enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE,
};

// Razorpay subscription.status values: created, authenticated, active, pending, halted,
// cancelled, completed, expired — mapped explicitly onto our narrower Prisma enum,
// same reasoning as the old Stripe status map: fail loudly on an unmapped value
// instead of casting past the type error.
const RAZORPAY_TO_PRISMA_STATUS: Record<string, SubscriptionStatus> = {
  created: SubscriptionStatus.incomplete,
  authenticated: SubscriptionStatus.incomplete,
  active: SubscriptionStatus.active,
  pending: SubscriptionStatus.past_due,
  halted: SubscriptionStatus.past_due,
  cancelled: SubscriptionStatus.canceled,
  completed: SubscriptionStatus.canceled,
  expired: SubscriptionStatus.canceled,
};

// POST /api/v1/businesses/:businessId/billing/subscription — Owner only
// Unlike Stripe Checkout, Razorpay has no hosted payment page to redirect to — the
// client (web or React Native) opens Razorpay's own Checkout SDK using the ids
// returned here to complete authorization; the actual state change arrives via webhook.
billingRouter.post(
  "/subscription",
  requireAuth,
  requireRole("owner"),
  async (req, res) => {
    if (!isRazorpayConfigured) {
      return res
        .status(501)
        .json({ error: { code: "not_configured", message: "Billing is not configured on this server yet" } });
    }

    const plan = req.body?.plan as "pro" | "enterprise" | undefined;
    const planId = plan ? PLAN_IDS[plan] : undefined;
    if (!plan || !planId) {
      return res.status(400).json({ error: { code: "bad_request", message: "Unknown or unconfigured plan" } });
    }

    const business = await prisma.business.findUniqueOrThrow({ where: { id: req.params.businessId } });

    const subscription = await getRazorpay().subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      // Razorpay requires a finite number of billing cycles; 120 months (~10 years)
      // stands in for "until cancelled" since there's no unlimited option.
      total_count: 120,
      notes: { businessId: business.id, plan },
    });

    res.json({ subscriptionId: subscription.id, keyId: process.env.RAZORPAY_KEY_ID });
  }
);

function resolvePeriodEnd(entity: { current_end?: number; charge_at?: number; start_at?: number }): Date {
  const epochSeconds = entity.current_end ?? entity.charge_at ?? entity.start_at;
  return epochSeconds ? new Date(epochSeconds * 1000) : new Date();
}

// Razorpay requires the raw body to verify the HMAC-SHA256 webhook signature — mounted
// separately in app.ts with express.raw(), NOT the global express.json() middleware.
export async function razorpayWebhookHandler(req: Request, res: Response) {
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).send("Missing signature or webhook secret");
  }

  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(req.body).digest("hex");
  const signatureValid =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!signatureValid) {
    return res.status(400).send("Webhook signature verification failed");
  }

  const event = JSON.parse(req.body.toString());

  switch (event.event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.pending":
    case "subscription.halted":
    case "subscription.cancelled":
    case "subscription.completed": {
      const subscriptionEntity = event.payload?.subscription?.entity;
      const businessId = subscriptionEntity?.notes?.businessId as string | undefined;
      if (!businessId) break;

      const business = await prisma.business.findUnique({ where: { id: businessId } });
      if (!business) break;

      const plan: Plan = subscriptionEntity.notes?.plan === "enterprise" ? Plan.enterprise : Plan.pro;
      const status = RAZORPAY_TO_PRISMA_STATUS[subscriptionEntity.status] ?? SubscriptionStatus.incomplete;

      await prisma.subscription.upsert({
        where: { businessId: business.id },
        update: {
          razorpaySubscriptionId: subscriptionEntity.id,
          plan,
          status,
          currentPeriodEnd: resolvePeriodEnd(subscriptionEntity),
        },
        create: {
          businessId: business.id,
          razorpaySubscriptionId: subscriptionEntity.id,
          plan,
          status,
          currentPeriodEnd: resolvePeriodEnd(subscriptionEntity),
        },
      });

      // subscription.charged carries a payment entity alongside the subscription — record
      // it as an invoice. Other event types (activated/pending/etc.) have no payment yet.
      const paymentEntity = event.payload?.payment?.entity;
      if (paymentEntity) {
        await prisma.invoice.upsert({
          where: { razorpayPaymentId: paymentEntity.id },
          update: {},
          create: {
            businessId: business.id,
            razorpayPaymentId: paymentEntity.id,
            amountDue: paymentEntity.amount,
            status: paymentEntity.status === "captured" ? "paid" : "open",
            issuedAt: new Date(paymentEntity.created_at * 1000),
          },
        });
      }

      await createNotification(business.ownerId, business.id, "billing_event", {
        subscriptionStatus: status,
        plan,
      });
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
}
