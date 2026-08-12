import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { apiFetch, ApiError } from "../lib/api";
import { getActiveBusinessId } from "../lib/business";

interface Task {
  id: string;
  status: string;
}

export default function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const businessId = await getActiveBusinessId();
      if (!businessId) return;
      try {
        const data = await apiFetch<Task[]>(`/api/v1/businesses/${businessId}/tasks`);
        setTasks(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const open = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;

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
    <View className="flex-1 gap-3 bg-gray-50 p-6">
      <View className="rounded-card border border-gray-200 bg-white p-5">
        <Text className="text-xs uppercase text-gray-400">Open tasks</Text>
        <Text className="mt-1 text-2xl font-semibold text-gray-900">{open}</Text>
      </View>
      <View className="rounded-card border border-gray-200 bg-white p-5">
        <Text className="text-xs uppercase text-gray-400">Completed</Text>
        <Text className="mt-1 text-2xl font-semibold text-gray-900">{done}</Text>
      </View>
      <View className="rounded-card border border-gray-200 bg-white p-5">
        <Text className="text-xs uppercase text-gray-400">Total</Text>
        <Text className="mt-1 text-2xl font-semibold text-gray-900">{tasks.length}</Text>
      </View>
    </View>
  );
}
