import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { getToken, clearToken } from "../lib/auth";
import { getActiveBusinessId, getActiveBusinessRole, clearActiveBusiness } from "../lib/business";
import SignInScreen from "../screens/SignInScreen";
import SelectBusinessScreen from "../screens/SelectBusinessScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import MainTabs from "./MainTabs";

const Stack = createNativeStackNavigator();

type AuthState = "loading" | "signedOut" | "needsBusiness" | "ready";

export default function RootNavigator() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setAuthState("signedOut");
        return;
      }
      const businessId = await getActiveBusinessId();
      if (!businessId) {
        setAuthState("needsBusiness");
        return;
      }
      const r = await getActiveBusinessRole();
      if (!r) {
        // businessId without a role would be corrupted storage state (setActiveBusiness
        // always sets both together) — recover by clearing and re-selecting rather than
        // getting stuck, same class of fix applied to the web app's dashboard layout.
        await clearActiveBusiness();
        setAuthState("needsBusiness");
        return;
      }
      setRole(r);
      setAuthState("ready");
    })();
  }, []);

  async function handleSignOut() {
    await clearToken();
    await clearActiveBusiness();
    setAuthState("signedOut");
  }

  async function handleSwitchBusiness() {
    await clearActiveBusiness();
    setAuthState("needsBusiness");
  }

  if (authState === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {authState === "signedOut" && (
          <Stack.Screen name="SignIn">{() => <SignInScreen onSignedIn={() => setAuthState("needsBusiness")} />}</Stack.Screen>
        )}
        {authState === "needsBusiness" && (
          <Stack.Screen name="SelectBusiness">
            {() => (
              <SelectBusinessScreen
                onSelected={(r) => {
                  setRole(r);
                  setAuthState("ready");
                }}
              />
            )}
          </Stack.Screen>
        )}
        {authState === "ready" && role && (
          <>
            <Stack.Screen name="Main">
              {() => <MainTabs role={role} onSwitchBusiness={handleSwitchBusiness} onSignOut={handleSignOut} />}
            </Stack.Screen>
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ headerShown: true, title: "Notifications" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
