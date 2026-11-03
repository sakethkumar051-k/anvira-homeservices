async function unavailable(): Promise<never> {
  throw new Error("Push notifications are available in the Android and iPhone apps.");
}
export const getPermissionsAsync = unavailable;
export const requestPermissionsAsync = unavailable;
export const getExpoPushTokenAsync = unavailable;
