import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import TasksScreen from "../screens/TasksScreen";
import TeamScreen from "../screens/TeamScreen";
import BillingScreen from "../screens/BillingScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

interface Props {
  role: string;
  onSwitchBusiness: () => void;
  onSignOut: () => void;
}

// Employee sees a reduced tab set (Home, Tasks, Profile) — matches the mobile IA in
// docs/05-uiux-design.md §2 exactly, including which roles see Team/Billing.
export default function MainTabs({ role, onSwitchBusiness, onSignOut }: Props) {
  const isElevated = role === "owner" || role === "manager";

  return (
    <Tab.Navigator screenOptions={{ headerShown: true, tabBarActiveTintColor: "#2563EB" }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      {isElevated && <Tab.Screen name="Team" component={TeamScreen} />}
      {isElevated && <Tab.Screen name="Billing" component={BillingScreen} />}
      <Tab.Screen name="Profile">{() => <ProfileScreen onSwitchBusiness={onSwitchBusiness} onSignOut={onSignOut} />}</Tab.Screen>
    </Tab.Navigator>
  );
}
