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
import { billingRouter, stripeWebhookHandler } from "./routes/billing";

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Stripe webhook needs the raw body for signature verification, so it must be
// mounted before the global express.json() middleware.
app.post("/api/v1/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/businesses", businessesRouter);
app.use("/api/v1/businesses/:businessId/members", membersRouter);
app.use("/api/v1/businesses/:businessId/tasks", tasksRouter);
app.use("/api/v1/businesses/:businessId/billing", billingRouter);

export default app;
