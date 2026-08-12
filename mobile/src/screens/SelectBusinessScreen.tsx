import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { apiFetch, ApiError } from "../lib/api";
import { setActiveBusiness } from "../lib/business";

interface Business {
  id: string;
  name: string;
  role: string;
}

export default function SelectBusinessScreen({ onSelected }: { onSelected: (role: string) => void }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiFetch<Business[]>("/api/v1/businesses")
      .then(setBusinesses)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load businesses"))
      .finally(() => setLoading(false));
  }, []);

  async function select(business: Business) {
    await setActiveBusiness(business.id, business.role);
    onSelected(business.role);
  }

  async function createBusiness() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const business = await apiFetch<{ id: string; name: string }>("/api/v1/businesses", {
        method: "POST",
        body: JSON.stringify({ name: newName }),
      });
      await select({ ...business, role: "owner" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create business");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-16">
      <Text className="mb-4 text-lg font-semibold text-gray-900">Select a business</Text>
      {error && <Text className="mb-4 text-sm text-danger">{error}</Text>}
      <FlatList
        data={businesses}
        keyExtractor={(b) => b.id}
        ListEmptyComponent={<Text className="text-sm text-gray-500">No businesses yet</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => select(item)}
            className="mb-2 flex-row items-center justify-between rounded-card border border-gray-200 bg-white px-4 py-3"
          >
            <Text className="text-sm text-gray-900">{item.name}</Text>
            <Text className="text-xs uppercase text-gray-400">{item.role}</Text>
          </Pressable>
        )}
      />
      <View className="mt-4 flex-row gap-2">
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="New business name"
          className="flex-1 rounded-card border border-gray-300 bg-white px-3 py-2 text-sm"
        />
        <Pressable
          onPress={createBusiness}
          disabled={creating}
          className="items-center justify-center rounded-card bg-primary px-4 py-2 disabled:opacity-50"
        >
          <Text className="text-sm font-medium text-white">Create</Text>
        </Pressable>
      </View>
    </View>
  );
}
