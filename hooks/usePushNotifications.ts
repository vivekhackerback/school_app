import { useState, useEffect, useRef } from 'react';
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
      Alert.alert("Push Notification Warning", "Use a physical device. Push notifications do not run on simulators.");
      return undefined;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert("Permission Error", "Permission not granted for push notifications.");
      return undefined;
    }

    // EAS Project ID is required for standalone APK/AAB builds in SDK 54
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      Alert.alert(
        "Configuration Missing",
        "EAS Project ID not found in app.json configuration. Please run 'npx eas init' to configure your project, or test within Expo Go."
      );
      return undefined;
    }

    try {
      // Get the token (passing projectId as required in SDK 54)
      const tokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenObj.data;
      console.log("Expo Push Token generated successfully:", token);
    } catch (e: any) {
      console.error("Error fetching Expo push token:", e);
      Alert.alert("Token Retrieval Failed", e.message || "Failed to fetch push token.");
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
        throw new Error(`Invalid server response: ${responseText}`);
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed saving token to backend.');
      }
      console.log('Expo Push Token registered on server successfully.');
      if (Platform.OS === 'android') {
        ToastAndroid.show('Push token saved to server successfully', ToastAndroid.SHORT);
      } else {
        Alert.alert('Token Saved', 'Push token saved to server successfully');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('Failed to sync push token with backend: Network request timed out (5s).');
      } else {
        console.error('Failed to sync push token with backend:', error.message || error);
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

  useEffect(() => {
    // 3. Skip setting up native event listeners in Expo Go client to prevent native wrapper crashes
    if (isExpoGo) return;

    // Listener for foreground notifications
    notificationListener.current = Notifications.addNotificationReceivedListener((incomingNotif) => {
      console.log("Foreground notification received:", incomingNotif);
      setNotification(incomingNotif);
    });

    // Listener for tapped notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification response received (tapped):", response);
      setLastNotificationResponse(response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
    lastNotificationResponse,
  };
}
