import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { authRouter } from "./routes/auth";
import { businessesRouter } from "./routes/businesses";
import { membersRouter } from "./routes/members";
import { tasksRouter } from "./routes/tasks";
import { billingRouter, razorpayWebhookHandler } from "./routes/billing";
import { performanceRouter, performanceReviewsRouter } from "./routes/performance";
import { notificationsRouter } from "./routes/notifications";
import { razorpayTestRouter } from "./routes/razorpayTest";
import { razorpayTestPageHtml } from "./publicPages/razorpayTestPage";

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Razorpay webhook needs the raw body for HMAC signature verification, so it must be
// mounted before the global express.json() middleware.
app.post("/api/v1/razorpay/webhook", express.raw({ type: "application/json" }), razorpayWebhookHandler);

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

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

export default app;
