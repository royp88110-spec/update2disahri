import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Platform } from "react-native";

const EAS_PROJECT_ID = "90c6b041-d355-4c73-bc71-93aab3e9774b";

type NotificationData = Record<string, unknown>;

const ROUTES = {
  admin: "/admin",
  advances: "/member/advances",
  announcement: "/member/notices",
  announcements: "/member/notices",
  expenses: "/member/expenses",
  fines: "/member/fines",
  meal: "/member/meals",
  meals: "/member/meals",
  menu: "/member/menu",
  notice: "/member/notices",
  notices: "/member/notices",
  payment: "/member/payments",
  payments: "/member/payments",
} as const;

let notificationListenersInitialized = false;

function getNotificationRoute(data: NotificationData): string {
  const explicitRoute =
    typeof data.route === "string"
      ? data.route
      : typeof data.screen === "string"
        ? data.screen
        : typeof data.url === "string"
          ? data.url
          : null;

  if (explicitRoute) {
    const normalizedRoute = explicitRoute.startsWith("/")
      ? explicitRoute
      : `/${explicitRoute}`;

    const isAllowedRoute =
      normalizedRoute === "/admin" ||
      normalizedRoute.startsWith("/member/");

    if (isAllowedRoute) {
      return normalizedRoute;
    }
  }

  const type = typeof data.type === "string" ? data.type.toLowerCase() : "";
  const destination =
    typeof data.destination === "string"
      ? data.destination.toLowerCase()
      : "";

  return (
    ROUTES[type as keyof typeof ROUTES] ??
    ROUTES[destination as keyof typeof ROUTES] ??
    ROUTES.notices
  );
}

function routeNotificationResponse(
  response: Notifications.NotificationResponse,
) {
  const data = response.notification.request.content.data as NotificationData;
  const route = getNotificationRoute(data);

  console.log("[PushNotifications] Notification tapped", {
    route,
    data,
  });

  setTimeout(() => {
    router.replace(route as never);
  }, 0);
}

export function initializeNotificationListeners() {
  if (notificationListenersInitialized) {
    return;
  }

  notificationListenersInitialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      console.log("[PushNotifications] Notification received", {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
      });

      return {
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });

  Notifications.addNotificationReceivedListener((notification) => {
    console.log("[PushNotifications] Notification received", {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data: notification.request.content.data,
    });
  });

  Notifications.addNotificationResponseReceivedListener(
    routeNotificationResponse,
  );

  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        routeNotificationResponse(response);
      }
    })
    .catch((error) => {
      console.error(
        "[PushNotifications] Could not read the launch notification",
        error,
      );
    });
}

async function savePushToken(
  token: string,
  memberId?: string,
): Promise<boolean> {
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const supabase = getSupabase();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "[PushNotifications] Could not identify the member for token save",
        userError,
      );
      return false;
    }

    // Prefer the authenticated user's relation. The member id fallback keeps
    // this helper usable for legacy rows without user_id.
    let update = supabase
      .from("members")
      .update({ push_token: token })
      .select("id");
    update = update.eq("user_id", user.id);

    let result = await update.maybeSingle();
    if (!result.data && !result.error && memberId) {
      result = await supabase
        .from("members")
        .update({ push_token: token })
        .eq("id", memberId)
        .select("id")
        .maybeSingle();
    }

    if (result.error) {
      console.error("[PushNotifications] Push token could not be saved in Supabase", result.error);
      return false;
    }

    if (!result.data) {
      console.error("[PushNotifications] Push token update matched no member row", {
        memberId,
        authUserId: user.id,
      });
      return false;
    }

    console.log("[PushNotifications] Push token saved in Supabase");
    return true;
  } catch (error) {
    console.error(
      "[PushNotifications] Push token save failed",
      error,
    );
    return false;
  }
}

export async function registerForPushNotifications(memberId?: string) {
  initializeNotificationListeners();

  if (!Device.isDevice) {
    console.log(
      "[PushNotifications] Push registration skipped: physical device required",
    );
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn(
      "[PushNotifications] Permission not granted",
      finalStatus,
    );
    return null;
  }

  console.log("[PushNotifications] Permission granted");

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? EAS_PROJECT_ID;

    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    if (
      !token.data ||
      !token.data.startsWith("ExponentPushToken[")
    ) {
      console.error(
        "[PushNotifications] Expo returned an invalid push token",
        token.data,
      );
      return null;
    }

    console.log(
      "[PushNotifications] Push token generated",
      token.data,
    );

    const saved = await savePushToken(token.data, memberId);
    if (!saved) {
      return null;
    }

    return token.data;
  } catch (error) {
    console.error(
      "[PushNotifications] Push token generation failed",
      error,
    );

    return null;
  }
}