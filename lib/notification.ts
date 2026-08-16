const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

type PushPayload = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
};

export async function sendExpoPushNotifications(messages: PushPayload[]): Promise<void> {
  const validMessages = messages.filter(
    (message) =>
      typeof message.to === "string" &&
      message.to.startsWith("ExponentPushToken["),
  );

  if (validMessages.length === 0) {
    console.warn("[PushNotifications] No valid Expo push tokens to send");
    return;
  }

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validMessages),
  });

  const result = (await response.json()) as {
    data?: Array<{ status?: string; message?: string; details?: { error?: string } }>;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok || result.errors?.length) {
    const message =
      result.errors?.map((error) => error.message).filter(Boolean).join("; ") ??
      `Expo Push API returned HTTP ${response.status}`;
    throw new Error(message);
  }

  const failed = (result.data ?? []).filter(
    (ticket) => ticket.status === "error" || ticket.details?.error,
  );
  if (failed.length > 0) {
    throw new Error(
      failed
        .map((ticket) => ticket.message ?? ticket.details?.error ?? "Push delivery failed")
        .join("; "),
    );
  }

  console.log("[PushNotifications] Expo push messages accepted", {
    count: validMessages.length,
  });
}