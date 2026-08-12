import AsyncStorage from "@react-native-async-storage/async-storage";

const BUSINESS_ID_KEY = "bma_business_id";
const BUSINESS_ROLE_KEY = "bma_business_role";

export async function getActiveBusinessId(): Promise<string | null> {
  return AsyncStorage.getItem(BUSINESS_ID_KEY);
}

export async function getActiveBusinessRole(): Promise<string | null> {
  return AsyncStorage.getItem(BUSINESS_ROLE_KEY);
}

export async function setActiveBusiness(id: string, role: string): Promise<void> {
  await AsyncStorage.multiSet([
    [BUSINESS_ID_KEY, id],
    [BUSINESS_ROLE_KEY, role],
  ]);
}

export async function clearActiveBusiness(): Promise<void> {
  await AsyncStorage.multiRemove([BUSINESS_ID_KEY, BUSINESS_ROLE_KEY]);
}
