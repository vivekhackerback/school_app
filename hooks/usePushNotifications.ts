import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert, ToastAndroid } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_CONFIG } from '@/constants/config';

// 1. Detect if running inside standard Expo Go store client
const executionEnv = Constants.executionEnvironment as string;
const isExpoGo = executionEnv === 'expo' || executionEnv === 'store-client';

// 2. Configure foreground behavior conditionally (bypassing under Expo Go to prevent crashes)
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Custom hook to manage Expo Push Notifications setup and registration.
 * Registers token with server on userId change, and manages notification listeners.
 */
export function usePushNotifications(userId: string | null) {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const [lastNotificationResponse, setLastNotificationResponse] = useState<Notifications.NotificationResponse | undefined>(undefined);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Core registration logic matching user specifications
  async function registerForPushNotificationsAsync(): Promise<string | undefined> {
    // A. Return mock token immediately if inside Expo Go to avoid calling any native API
    if (isExpoGo) {
      console.warn("Expo Go does not support remote push notifications in Android for SDK 54. Returning a mock token for local testing.");
      return `ExponentPushToken[MockTokenForLocalExpoGoTesting-${userId || 'guest'}]`;
    }

    let token: string | undefined;

    // Create notification channel for Android (required for SDK 26+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (!Device.isDevice) {
      console.log("[PushNotifications] Running on simulator/virtual device. Skipping push token registration.");
      return undefined;
    }

    let finalStatus = 'undetermined';
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
    } catch (permError) {
      console.warn("[PushNotifications] Could not check or request permissions:", permError);
      return undefined;
    }

    if (finalStatus !== 'granted') {
      console.log("[PushNotifications] Permission not granted for push notifications.");
      return undefined;
    }

    // EAS Project ID is required for standalone APK/AAB builds in SDK 54
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn("[PushNotifications] EAS Project ID not found in app configuration.");
      return undefined;
    }

    try {
      // Get the token (passing projectId as required in SDK 54)
      const tokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenObj.data;
      console.log("[PushNotifications] Expo Push Token generated:", token);
    } catch (e: any) {
      console.warn("[PushNotifications] Non-fatal: Failed to fetch push token:", e?.message || e);
    }

    return token;
  }

  // Upload/sync device token with server
  async function syncTokenWithBackend(token: string, currentUserId: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000); // 5 seconds request timeout limit

    try {
      const response = await fetch(API_CONFIG.SAVE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          user_id: currentUserId,
          expo_push_token: token,
          platform: Platform.OS,
          device_name: Device.modelName || 'Unknown Device',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        console.warn(`[PushNotifications] Invalid server response saving token: ${responseText}`);
        return;
      }

      if (response.ok && result?.success) {
        console.log('[PushNotifications] Push token registered on server successfully.');
      } else {
        console.warn('[PushNotifications] Server returned error saving token:', result?.message || responseText);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('[PushNotifications] Push token sync timed out (5s).');
      } else {
        console.warn('[PushNotifications] Push token sync error:', error.message || error);
      }
    }
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const token = await registerForPushNotificationsAsync();
      if (!active) return;

      if (token) {
        setExpoPushToken(token);
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [userId]);

  // Log token and handle case where user ID becomes available after token is retrieved
  useEffect(() => {
    if (expoPushToken) {
      console.log("\n================ EXPO PUSH TOKEN ================");
      console.log(expoPushToken);
      console.log("=================================================\n");
      
      if (userId) {
        syncTokenWithBackend(expoPushToken, userId);
      }
    }
  }, [expoPushToken, userId]);

  // In-memory set to prevent duplicate receipt network requests
  const processedReceipts = useRef<Set<string>>(new Set());

  /**
   * Reusable function to send push notification receipt/acknowledgement to PHP backend.
   * Extracts notification details, device metadata, timestamp, and dispatches JSON POST request safely.
   */
  const sendNotificationReceipt = useCallback(async (
    incomingNotification: Notifications.Notification,
    eventType: 'received' | 'opened' = 'received',
    tokenOverride?: string
  ) => {
    try {
      const activeToken = tokenOverride || expoPushToken;
      const content = incomingNotification.request?.content || {};
      const notifData = content.data || {};

      // Extract unique notification_id (checks recordId, notification_id, id, or Expo identifier fallback)
      const rawId =
        notifData.recordId ??
        notifData.notification_id ??
        notifData.id ??
        incomingNotification.request?.identifier;
      const notificationId = rawId ? String(rawId) : `notif_${Date.now()}`;

      // Deduplication check per event type
      const receiptKey = `${notificationId}_${eventType}`;
      if (processedReceipts.current.has(receiptKey)) {
        console.log(`[Receipt] Event '${receiptKey}' already logged. Skipping duplicate request.`);
        return;
      }
      processedReceipts.current.add(receiptKey);

      const payload = {
        notification_id: notificationId,
        expo_push_token: activeToken || 'ExponentPushToken[NOT_AVAILABLE]',
        title: content.title || '',
        body: content.body || '',
        received_at: new Date().toISOString(),
        event_type: eventType,
        data: notifData,
        device_info: {
          platform: Platform.OS,
          model_name: Device.modelName || 'Unknown Device',
          os_version: Device.osVersion || '',
          app_version: Constants.expoConfig?.version || '1.0.0',
        },
      };

      console.log(`[Receipt] Dispathing notification receipt (${eventType}):`, payload);

      // Async fetch call wrapped in 5s AbortController timeout to guarantee non-blocking behavior
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000);

      const response = await fetch(API_CONFIG.RECEIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        console.warn('[Receipt] Server response parsing failed:', responseText);
      }

      if (response.ok && result?.success) {
        console.log(`[Receipt] Server acknowledged notification ${notificationId} (${eventType}).`);
      } else {
        console.warn(`[Receipt] Server returned error for ${notificationId}:`, result?.message || responseText);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[Receipt] Network timeout (5s) sending notification receipt to server.');
      } else {
        console.error('[Receipt] Error sending notification receipt:', error.message || error);
      }
    }
  }, [expoPushToken]);

  useEffect(() => {
    // 3. Skip setting up native event listeners in Expo Go client to prevent native wrapper crashes
    if (isExpoGo) return;

    // Listener for incoming/received notifications
    notificationListener.current = Notifications.addNotificationReceivedListener((incomingNotif) => {
      console.log("Foreground notification received:", incomingNotif);
      setNotification(incomingNotif);

      // Send receipt immediately without blocking notification presentation
      sendNotificationReceipt(incomingNotif, 'received');
    });

    // Listener for notification response (user tapped/opened notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification response received (tapped):", response);
      setLastNotificationResponse(response);

      // Send response receipt immediately for tapped notification
      if (response?.notification) {
        sendNotificationReceipt(response.notification, 'opened');
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [sendNotificationReceipt]);

  return {
    expoPushToken,
    notification,
    lastNotificationResponse,
    sendNotificationReceipt,
  };
}
