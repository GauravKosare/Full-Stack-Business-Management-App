# Mobile App

React Native / Expo mobile app — Phase 5a, scaffolded. See:

- [PRD](../docs/01-PRD.md) — dual-platform scope
- [TRD](../docs/02-TRD.md) §2 — tech stack (Expo, TypeScript, NativeWind)
- [UI/UX Design](../docs/05-uiux-design.md) §2-3 — bottom-tab navigation, screen layouts
- [Implementation Plan](../docs/06-implementation-plan.md) — Phase 5a

## Structure

- `App.tsx` — root entry, wraps `RootNavigator` in `SafeAreaProvider`
- `src/lib/` — `api.ts` (fetch wrapper, mirrors `../web/lib/api.ts`), `auth.ts` / `business.ts` (AsyncStorage, mirrors `../web/lib`'s localStorage versions), `googleAuth.ts` (OAuth via `expo-web-browser`)
- `src/navigation/` — `RootNavigator.tsx` (auth-state-driven stack: sign-in → select business → main app), `MainTabs.tsx` (role-gated bottom tabs)
- `src/screens/` — one screen per tab (Home, Tasks, Team, Billing, Profile) plus `NotificationsScreen` (reached from Profile, not its own tab — see UI/UX doc §2)

No code is shared with `../web` — same API, same design tokens (`tailwind.config.js` values match `../web/tailwind.config.ts`), separate codebases, per the dual-platform decision in the Implementation Plan.

## Running locally

```bash
cp .env.example .env   # set EXPO_PUBLIC_API_URL if not using the Android emulator default
npm run android         # or: npm run ios
```

`EXPO_PUBLIC_API_URL` defaults to `http://10.0.2.2:3000` (the Android emulator's alias for the host machine) if unset. iOS simulator can reach `localhost:3000` directly. A **real device** needs the host machine's actual LAN IP set explicitly.

The API's `MOBILE_AUTH_REDIRECT_URL` must stay `myapp://auth` to match this app's `scheme` in `app.json`.

## Known gaps (by design, not oversights)

- **Billing checkout isn't wired up** — `BillingScreen` creates the Razorpay subscription via the API but doesn't open a native checkout modal. Completing that needs the `react-native-razorpay` native SDK, which requires a custom Expo dev client (EAS build) — Expo Go can't load arbitrary native modules. The web app's Billing page already completes this via the browser Checkout widget.
- **No push notifications yet** — in-app notification list works; Expo Push registration is a separate follow-up (Implementation Plan, Phase 6).
