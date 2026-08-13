import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { isGoogleAuthConfigured } from "./lib/passport";
import { isBrevoConfigured } from "./lib/brevo";
import { isRazorpayConfigured } from "./lib/razorpay";
import { isRealtimeConfigured } from "./lib/realtime";
import { isStorageConfigured } from "./lib/storage";
import { authRouter } from "./routes/auth";
import { businessesRouter } from "./routes/businesses";
import { membersRouter } from "./routes/members";
import { tasksRouter } from "./routes/tasks";
import { billingRouter, razorpayWebhookHandler } from "./routes/billing";
import { performanceRouter, performanceReviewsRouter } from "./routes/performance";
import { notificationsRouter } from "./routes/notifications";
import { chatRouter } from "./routes/chat";
import { razorpayTestRouter } from "./routes/razorpayTest";
import { razorpayTestPageHtml } from "./publicPages/razorpayTestPage";

const app = express();

// maxAge caches the browser's CORS preflight (OPTIONS) response for a day, so repeat
// calls to the same endpoint+method within a session skip an extra network round-trip
// entirely — a real, free latency win given web and api are on different origins.
app.use(cors({ maxAge: 86400 }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Razorpay webhook needs the raw body for HMAC signature verification, so it must be
// mounted before the global express.json() middleware.
app.post("/api/v1/razorpay/webhook", express.raw({ type: "application/json" }), razorpayWebhookHandler);

app.use(express.json());

// Booleans only, never secret values — safe to leave public, useful for confirming an
// env var actually landed on the deployment that's currently serving traffic.
app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    configured: {
      google: isGoogleAuthConfigured,
      brevo: isBrevoConfigured,
      razorpay: isRazorpayConfigured,
      realtime: isRealtimeConfigured,
      storage: isStorageConfigured,
      webAppUrl: Boolean(process.env.WEB_APP_URL),
    },
  })
);

// Razorpay Standard Checkout connectivity test — deliberately unauthenticated for
// low-friction manual testing, so it must not exist at all in production, not just be
// hidden. Routes aren't registered outside development rather than gated behind a
// runtime check, so there's no code path that could accidentally expose them.
if (process.env.NODE_ENV !== "production") {
  app.get("/razorpay-test", (_req, res) => res.type("html").send(razorpayTestPageHtml));
  app.use("/api/v1/razorpay-test", razorpayTestRouter);
}

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/businesses", businessesRouter);
app.use("/api/v1/businesses/:businessId/members", membersRouter);
app.use("/api/v1/businesses/:businessId/tasks", tasksRouter);
app.use("/api/v1/businesses/:businessId/billing", billingRouter);
app.use("/api/v1/businesses/:businessId/performance", performanceRouter);
app.use("/api/v1/businesses/:businessId/performance-reviews", performanceReviewsRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/v1/businesses/:businessId/channels", chatRouter);

export default app;
