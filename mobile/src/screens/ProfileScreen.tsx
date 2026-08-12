import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

interface Props {
  onSwitchBusiness: () => void;
  onSignOut: () => void;
}

// Notifications on mobile is reached from here rather than a dedicated bottom tab,
// per the UI/UX doc §2 (five tabs max: Home, Tasks, Team, Billing, Profile).
export default function ProfileScreen({ onSwitchBusiness, onSignOut }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, undefined>>>();

  return (
    <View className="flex-1 gap-2 bg-gray-50 p-6">
      <Pressable
        onPress={() => navigation.navigate("Notifications")}
        className="rounded-card border border-gray-200 bg-white px-4 py-3"
      >
        <Text className="text-sm text-gray-900">Notifications</Text>
      </Pressable>
      <Pressable onPress={onSwitchBusiness} className="rounded-card border border-gray-200 bg-white px-4 py-3">
        <Text className="text-sm text-gray-900">Switch business</Text>
      </Pressable>
      <Pressable onPress={onSignOut} className="rounded-card border border-gray-200 bg-white px-4 py-3">
        <Text className="text-sm text-danger">Sign out</Text>
      </Pressable>
    </View>
  );
}
