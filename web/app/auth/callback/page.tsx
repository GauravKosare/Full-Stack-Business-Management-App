"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("Missing code in callback URL");
      return;
    }

    apiFetch<{ token: string }>("/api/v1/auth/exchange", {
      method: "POST",
      body: JSON.stringify({ code }),
    })
      .then(({ token }) => {
        setToken(token);
        router.replace("/select-business");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Sign-in failed"));
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      {error ? <p className="text-danger">{error}</p> : <p className="text-gray-500">Signing you in…</p>}
    </div>
  );
}

// useSearchParams requires a Suspense boundary in the App Router.
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
