import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { apiFetch, ApiError } from "../lib/api";
import { getActiveBusinessId } from "../lib/business";

export default function BillingScreen() {
  const [loading, setLoading] = useState<"pro" | "enterprise" | null>(null);
  const [result, setResult] = useState<{ subscriptionId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: "pro" | "enterprise") {
    const businessId = await getActiveBusinessId();
    if (!businessId) return;
    setLoading(plan);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<{ subscriptionId: string; keyId: string }>(
        `/api/v1/businesses/${businessId}/billing/subscription`,
        { method: "POST", body: JSON.stringify({ plan }) }
      );
      setResult({ subscriptionId: data.subscriptionId });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start checkout");
    } finally {
      setLoading(null);
    }
  }

  return (
    <View className="flex-1 gap-4 bg-gray-50 p-6">
      <View className="rounded-card border border-gray-200 bg-white p-5">
        <Text className="text-base font-semibold text-gray-900">Pro</Text>
        <Text className="mt-1 text-sm text-gray-500">For growing teams</Text>
        <Pressable
          onPress={() => subscribe("pro")}
          disabled={loading !== null}
          className="mt-3 items-center rounded-card bg-primary px-4 py-2 disabled:opacity-50"
        >
          {loading === "pro" ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-sm font-medium text-white">Upgrade to Pro</Text>
          )}
        </Pressable>
      </View>

      <View className="rounded-card border border-gray-200 bg-white p-5">
        <Text className="text-base font-semibold text-gray-900">Enterprise</Text>
        <Text className="mt-1 text-sm text-gray-500">For larger organizations</Text>
        <Pressable
          onPress={() => subscribe("enterprise")}
          disabled={loading !== null}
          className="mt-3 items-center rounded-card bg-primary px-4 py-2 disabled:opacity-50"
        >
          {loading === "enterprise" ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-sm font-medium text-white">Upgrade to Enterprise</Text>
          )}
        </Pressable>
      </View>

      {error && <Text className="text-sm text-danger">{error}</Text>}

      {result && (
        <View className="rounded-card border border-amber-200 bg-amber-50 p-4">
          <Text className="text-sm font-medium text-gray-900">Subscription created: {result.subscriptionId}</Text>
          {/* Honest scaffold-stage limitation, not an oversight: completing payment here
              needs the react-native-razorpay native SDK, which requires a custom Expo
              dev client (EAS build) — Expo Go can't load arbitrary native modules. The
              web app's Billing page already completes this via the browser Checkout
              widget; wiring up the native SDK is tracked in the Implementation Plan,
              Phase 5a follow-up. */}
          <Text className="mt-2 text-xs text-gray-600">
            The Razorpay Checkout modal isn&apos;t wired up on mobile yet — that needs the
            react-native-razorpay native SDK and a custom Expo dev client (EAS build), not just
            Expo Go. The web app&apos;s Billing page already completes this flow.
          </Text>
        </View>
      )}
    </View>
  );
}
