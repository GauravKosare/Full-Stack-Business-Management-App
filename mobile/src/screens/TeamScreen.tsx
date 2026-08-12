import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { apiFetch, ApiError } from "../lib/api";
import { getActiveBusinessId } from "../lib/business";

interface Member {
  id: string;
  role: string;
  joinedAt: string | null;
  user: { name: string; email: string };
}

const ROLES = ["employee", "manager", "client"] as const;

export default function TeamScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("employee");

  const load = useCallback(async () => {
    const businessId = await getActiveBusinessId();
    if (!businessId) return;
    try {
      const data = await apiFetch<Member[]>(`/api/v1/businesses/${businessId}/members`);
      setMembers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function invite() {
    if (!email.trim()) return;
    const businessId = await getActiveBusinessId();
    if (!businessId) return;
    await apiFetch(`/api/v1/businesses/${businessId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
    setEmail("");
    load();
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 p-6">
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email to invite"
        autoCapitalize="none"
        keyboardType="email-address"
        className="mb-2 rounded-card border border-gray-300 bg-white px-3 py-2 text-sm"
      />
      <View className="mb-4 flex-row gap-2">
        {ROLES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRole(r)}
            className={`rounded-pill px-3 py-1 ${role === r ? "bg-primary" : "bg-gray-200"}`}
          >
            <Text className={`text-xs font-medium ${role === r ? "text-white" : "text-gray-700"}`}>{r}</Text>
          </Pressable>
        ))}
        <Pressable onPress={invite} className="ml-auto items-center justify-center rounded-card bg-primary px-4 py-2">
          <Text className="text-sm font-medium text-white">Invite</Text>
        </Pressable>
      </View>

      {error && <Text className="mb-4 text-sm text-danger">{error}</Text>}

      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        ListEmptyComponent={<Text className="text-sm text-gray-500">No members yet</Text>}
        renderItem={({ item }) => (
          <View className="mb-2 rounded-card border border-gray-200 bg-white px-4 py-3">
            <Text className="text-sm text-gray-900">{item.user.name}</Text>
            <Text className="text-xs text-gray-500">{item.user.email}</Text>
            <Text className="mt-1 text-xs uppercase text-gray-400">
              {item.role} · {item.joinedAt ? "Joined" : "Pending"}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
