import { Router } from "express";
import Stripe from "stripe";
import { Plan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export const billingRouter = Router({ mergeParams: true });

const PRICE_IDS: Record<"pro" | "enterprise", string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

// Stripe's subscription.status has more values than our Prisma enum models (see
// https://stripe.com/docs/api/subscriptions/object#subscription_object-status) — map
// explicitly rather than casting, so an unmapped status fails loudly in review, not at
// runtime against the DB.
const STRIPE_TO_PRISMA_STATUS: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  trialing: SubscriptionStatus.trialing,
  active: SubscriptionStatus.active,
  past_due: SubscriptionStatus.past_due,
  canceled: SubscriptionStatus.canceled,
  incomplete: SubscriptionStatus.incomplete,
  incomplete_expired: SubscriptionStatus.canceled,
  unpaid: SubscriptionStatus.past_due,
  paused: SubscriptionStatus.canceled,
};

// POST /api/v1/businesses/:businessId/billing/checkout-session — Owner only
billingRouter.post(
  "/checkout-session",
  requireAuth,
  requireRole("owner"),
  async (req, res) => {
    const plan = req.body?.plan as "pro" | "enterprise" | undefined;
    const priceId = plan ? PRICE_IDS[plan] : undefined;
    if (!plan || !priceId) {
      return res.status(400).json({ error: { code: "bad_request", message: "Unknown or unconfigured plan" } });
    }

    const business = await prisma.business.findUniqueOrThrow({ where: { id: req.params.businessId } });

    const customerId =
      business.stripeCustomerId ??
      (
        await stripe.customers.create({
          name: business.name,
          metadata: { businessId: business.id },
        })
      ).id;

    if (!business.stripeCustomerId) {
      await prisma.business.update({ where: { id: business.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/billing/success`,
      cancel_url: `${process.env.APP_URL}/billing/cancel`,
      metadata: { businessId: business.id },
      // Read back from subscription.metadata in the webhook — more reliable than
      // inferring the plan from a Stripe Price's lookup_key, which requires separate
      // manual configuration in the Stripe Dashboard and is easy to forget.
      subscription_data: { metadata: { businessId: business.id, plan } },
    });

    res.json({ url: session.url });
  }
);

// Stripe requires the raw body for signature verification — mounted separately in server.ts
// with express.raw(), NOT the global express.json() middleware.
export async function stripeWebhookHandler(req: import("express").Request, res: import("express").Response) {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).send("Missing signature or webhook secret");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${(err as Error).message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscriptionId =
        event.type === "checkout.session.completed"
          ? ((event.data.object as Stripe.Checkout.Session).subscription as string)
          : (event.data.object as Stripe.Subscription).id;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const businessId = subscription.metadata?.businessId;
      const customer = subscription.customer as string;

      const business = businessId
        ? await prisma.business.findUnique({ where: { id: businessId } })
        : await prisma.business.findUnique({ where: { stripeCustomerId: customer } });

      if (business) {
        const plan: Plan = subscription.metadata?.plan === "enterprise" ? Plan.enterprise : Plan.pro;
        const status = STRIPE_TO_PRISMA_STATUS[subscription.status];

        await prisma.subscription.upsert({
          where: { businessId: business.id },
          update: {
            stripeSubscriptionId: subscription.id,
            plan,
            status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
          create: {
            businessId: business.id,
            stripeSubscriptionId: subscription.id,
            plan,
            status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
}
