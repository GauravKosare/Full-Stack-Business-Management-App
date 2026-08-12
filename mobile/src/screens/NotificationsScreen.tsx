import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { apiFetch, ApiError } from "../lib/api";

interface Notification {
  id: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Notification[]>("/api/v1/notifications");
      setNotifications(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    await apiFetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
    load();
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-sm text-danger">{error}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 p-6">
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={<Text className="text-sm text-gray-500">No notifications</Text>}
        renderItem={({ item }) => (
          <View
            className={`mb-2 flex-row items-center justify-between rounded-card border border-gray-200 px-4 py-3 ${
              item.readAt ? "bg-white" : "bg-blue-50"
            }`}
          >
            <View>
              <Text className="text-sm font-medium capitalize text-gray-900">{item.type.replace(/_/g, " ")}</Text>
              <Text className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            {!item.readAt && (
              <Pressable onPress={() => markRead(item.id)}>
                <Text className="text-xs font-medium text-primary">Mark read</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}
