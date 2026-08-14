import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } =
      await Notifications.requestPermissionsAsync();

    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(
      "default",
      {
        name: "default",
        importance:
          Notifications.AndroidImportance.MAX,
      }
    );
  }

  try {
    const token =
      await Notifications.getExpoPushTokenAsync({
        projectId:
          "90c6b041-d355-4c73-bc71-93aab3e9774b",
      });

    console.log(
      "EXPO PUSH TOKEN:",
      token.data
    );

    return token.data;
  } catch (error) {
    console.error(
      "PUSH TOKEN ERROR:",
      error
    );

    return null;
  }
}