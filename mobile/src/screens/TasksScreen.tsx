import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { apiFetch, ApiError } from "../lib/api";
import { getActiveBusinessId } from "../lib/business";

interface Task {
  id: string;
  title: string;
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  canceled: "bg-red-100 text-red-700",
};

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    const businessId = await getActiveBusinessId();
    if (!businessId) return;
    try {
      const data = await apiFetch<Task[]>(`/api/v1/businesses/${businessId}/tasks`);
      setTasks(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createTask() {
    if (!title.trim()) return;
    const businessId = await getActiveBusinessId();
    if (!businessId) return;
    await apiFetch(`/api/v1/businesses/${businessId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    setTitle("");
    load();
  }

  async function markDone(taskId: string) {
    const businessId = await getActiveBusinessId();
    if (!businessId) return;
    await apiFetch(`/api/v1/businesses/${businessId}/tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    });
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
      <View className="mb-4 flex-row gap-2">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="New task title"
          className="flex-1 rounded-card border border-gray-300 bg-white px-3 py-2 text-sm"
        />
        <Pressable onPress={createTask} className="items-center justify-center rounded-card bg-primary px-4 py-2">
          <Text className="text-sm font-medium text-white">Add</Text>
        </Pressable>
      </View>

      {error && <Text className="mb-4 text-sm text-danger">{error}</Text>}

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={<Text className="text-sm text-gray-500">No tasks yet</Text>}
        renderItem={({ item }) => (
          <View className="mb-2 flex-row items-center justify-between rounded-card border border-gray-200 bg-white px-4 py-3">
            <View className="flex-1">
              <Text className="text-sm text-gray-900">{item.title}</Text>
              <Text
                className={`mt-1 self-start rounded-pill px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
              >
                {item.status}
              </Text>
            </View>
            {item.status !== "done" && (
              <Pressable onPress={() => markDone(item.id)}>
                <Text className="text-xs font-medium text-primary">Mark done</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}
