import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { signInWithGoogle } from "../lib/googleAuth";

export default function SignInScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    const result = await signInWithGoogle();
    setLoading(false);
    if (result.type === "success") {
      onSignedIn();
    } else if (result.type === "error") {
      setError(result.message);
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 px-8">
      <Text className="mb-2 text-xl font-semibold text-gray-900">Business Management App</Text>
      <Text className="mb-6 text-sm text-gray-500">Sign in to continue</Text>
      <Pressable
        onPress={handleSignIn}
        disabled={loading}
        className="w-full items-center rounded-card bg-primary px-4 py-3 disabled:opacity-50"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-sm font-medium text-white">Sign in with Google</Text>
        )}
      </Pressable>
      {error && <Text className="mt-4 text-sm text-danger">{error}</Text>}
    </View>
  );
}
