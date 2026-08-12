import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { apiFetch, API_URL } from "./api";
import { setToken } from "./auth";

WebBrowser.maybeCompleteAuthSession();

export type GoogleSignInResult =
  | { type: "success" }
  | { type: "cancelled" }
  | { type: "error"; message: string };

// Mirrors the web app's auth flow exactly (see TRD §3 / api/src/routes/auth.ts):
// open a browser to our server's /auth/google?platform=mobile, receive a one-time
// code via a deep link, exchange it for the JWT. The server — not this app — is the
// actual OAuth client Google talks to; that's why this works with a "Web application"
// Google Cloud OAuth client type even though the caller is a native app.
//
// redirectUri is passed to the server explicitly (not assumed from its own
// MOBILE_AUTH_REDIRECT_URL env var) because Linking.createURL() doesn't return the
// app's real "myapp://" scheme under Expo Go — Expo Go can't register a third-party
// scheme, so it returns a session-specific "exp://<lan-ip>:<port>/--/auth" URL instead.
// Without this, openAuthSessionAsync would wait for a redirect the server never sends.
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const redirectUri = Linking.createURL("auth");
  const authUrl = `${API_URL}/api/v1/auth/google?platform=mobile&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== "success" || !result.url) {
    return { type: "cancelled" };
  }

  const { queryParams } = Linking.parse(result.url);
  const code = queryParams?.code as string | undefined;
  if (!code) {
    return { type: "error", message: "Missing code in redirect" };
  }

  try {
    const { token } = await apiFetch<{ token: string }>("/api/v1/auth/exchange", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    await setToken(token);
    return { type: "success" };
  } catch (err) {
    return { type: "error", message: err instanceof Error ? err.message : "Sign-in failed" };
  }
}
