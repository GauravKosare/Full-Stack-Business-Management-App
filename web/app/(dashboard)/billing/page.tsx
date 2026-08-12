"use client";

import { useState } from "react";
import Script from "next/script";
import { apiFetch } from "@/lib/api";
import { getActiveBusinessId } from "@/lib/business";

interface RazorpayCheckoutOptions {
  key: string;
  subscription_id: string;
  name: string;
  handler: () => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayCheckoutInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

export default function BillingPage() {
  const [loading, setLoading] = useState<"pro" | "enterprise" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const businessId = getActiveBusinessId();

  async function subscribe(plan: "pro" | "enterprise") {
    if (!businessId) return;
    setLoading(plan);
    setMessage(null);
    try {
      const { subscriptionId, keyId } = await apiFetch<{ subscriptionId: string; keyId: string }>(
        `/api/v1/businesses/${businessId}/billing/subscription`,
        { method: "POST", body: JSON.stringify({ plan }) }
      );

      const rzp = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: "Business Management App",
        handler: () => setMessage("Payment submitted — subscription status updates via webhook shortly."),
        modal: { ondismiss: () => setMessage("Checkout dismissed.") },
      });
      rzp.open();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Billing</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Pro</h2>
          <p className="mt-2 text-sm text-gray-500">For growing teams</p>
          <button
            onClick={() => subscribe("pro")}
            disabled={loading !== null}
            className="mt-4 w-full rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading === "pro" ? "Starting…" : "Upgrade to Pro"}
          </button>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Enterprise</h2>
          <p className="mt-2 text-sm text-gray-500">For larger organizations</p>
          <button
            onClick={() => subscribe("enterprise")}
            disabled={loading !== null}
            className="mt-4 w-full rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading === "enterprise" ? "Starting…" : "Upgrade to Enterprise"}
          </button>
        </div>
      </div>

      {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
    </div>
  );
}
