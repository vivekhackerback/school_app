import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  StatusBar,
  useColorScheme,
  Animated,
  ActivityIndicator,
  RefreshControl,
  AppState,
  Image,
  Linking,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_CONFIG } from '@/constants/config';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Define the notification types and interfaces
type CategoryType = 'All' | 'Academics' | 'Events' | 'Alerts' | 'Payments';
type PriorityType = 'Low' | 'Normal' | 'High' | 'Emergency';

interface NotificationItem {
  id: string;
  category: CategoryType;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  time: string;
  isUnread: boolean;
  priority: PriorityType;
  isFlashing?: boolean;
}

// Helper to convert created_at timestamp to friendly relative time safely
const formatTime = (createdAtString: any): string => {
  if (!createdAtString || typeof createdAtString !== 'string') return '';
  try {
    // Replace space with T to make ISO parsing reliable across platforms (especially iOS)
    const date = new Date(createdAtString.replace(' ', 'T'));
    if (isNaN(date.getTime())) return createdAtString;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch {
    return createdAtString;
  }
};

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Setup Push Notification integrations
  const MOCK_USER_ID = 'student_123';
  const { expoPushToken, notification, lastNotificationResponse } = usePushNotifications(MOCK_USER_ID);

  // State variables for raw API response data and fetching lifecycle
  const [rawNotifications, setRawNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State variables for App Update Modal
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  const [serverVersion, setServerVersion] = useState<string>('');

  // State and animation for Custom Drawer Menu
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const drawerAnimation = useRef(new Animated.Value(0)).current; // 0 = closed, 1 = open

  // Filter and language configurations
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Dynamically derive categories from raw notifications, pre-seeding all 10 backend defaults
  const categories = useMemo(() => {
    const defaults = [
      'Alerts',
      'Academics',
      'Payments',
      'Events',
      'Examination',
      'Homework',
      'Holiday',
      'Transport',
      'Circular',
      'General'
    ];
    const unique = new Set<string>(defaults);
    rawNotifications.forEach(item => {
      if (String(item.is_app) === '1' && item.category && item.category !== 'All') {
        unique.add(item.category);
      }
    });
    return ['All', ...Array.from(unique)];
  }, [rawNotifications]);
  
  // Track expanded cards
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  // Track active language for each card. Default to English ('en')
  const [cardLanguages, setCardLanguages] = useState<Record<string, 'en' | 'hi'>>({});
  // Keep track of notification IDs read in the current session
  const [readIds, setReadIds] = useState<Record<string, boolean>>({});

  // Loop animation ref for flashing neon badge
  const neonPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(neonPulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(neonPulse, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [neonPulse]);

  // Interpolate pulse values for scale and opacity to create neon flash glow
  const neonOpacity = neonPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  const neonScale = neonPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.06],
  });

  // App version check logic
  const checkAppVersion = useCallback(async (isManual = false) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000); // 5 seconds version check timeout limit

    try {
      const response = await fetch(API_CONFIG.VERSION_CHECK_URL, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
      const json = await response.json();
      if (json.status && json.version) {
        const localVersion = Constants.expoConfig?.version || '1.0.0';
        if (localVersion !== json.version) {
          setServerVersion(json.version);
          setShowUpdateModal(true);
        } else if (isManual) {
          Alert.alert(
            "App Up-to-Date",
            `You are already using the latest version (${localVersion}) of the school portal app.`,
            [{ text: "OK" }]
          );
        }
      } else if (isManual) {
        throw new Error('Invalid version response format.');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Failed to check app version from server:', err);
      if (isManual) {
        const errorMsg = err.name === 'AbortError' 
          ? "Network timeout (5s) checking for updates." 
          : (err.message || "Failed to check for updates.");
        Alert.alert(
          "Update Check Failed",
          errorMsg,
          [{ text: "OK" }]
        );
      }
    }
  }, []);

  const handleUpdateApp = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(API_CONFIG.PLAY_STORE_URL);
      if (supported) {
        await Linking.openURL(API_CONFIG.PLAY_STORE_URL);
      } else {
        // Fallback directly to opening in web browser
        await Linking.openURL('https://play.google.com/store/apps/details?id=com.gms.schoolapp');
      }
    } catch (err) {
      console.error('Error opening update URL:', err);
    }
  }, []);

  const toggleDrawer = useCallback((open: boolean) => {
    if (open) {
      setIsDrawerOpen(true);
      Animated.timing(drawerAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(drawerAnimation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsDrawerOpen(false);
      });
    }
  }, [drawerAnimation]);

  // API Fetching logic (wrapped in useCallback for dependency safety)
  const fetchNotifications = useCallback(async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) {
      setLoading(true);
    }
    setError(null);
    
    // Create an AbortController to enforce a 5-second timeout limit
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000);

    try {
      // Bypass HTTP caching by appending a cache-buster timestamp and headers
      const busterUrl = `${API_CONFIG.API_URL}${API_CONFIG.API_URL.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const response = await fetch(busterUrl, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      
      // Request completed, clear the timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Unable to parse server response. Check if the ngrok URL has expired or returned an error page.');
      }

      if (json.status && Array.isArray(json.data)) {
        setRawNotifications(json.data);

        // Auto-expand the first item if it is marked as Emergency or High priority
        const firstItem = json.data[0];
        if (firstItem && (firstItem.priority === 'Emergency' || firstItem.priority === 'High')) {
          const idStr = String(firstItem.id);
          setExpandedIds(prev => ({ ...prev, [idStr]: true }));
          // Auto-mark as read
          setReadIds(prev => ({ ...prev, [idStr]: true }));
        }
      } else {
        throw new Error('API request succeeded, but returned an invalid data format.');
      }
    } catch (err: any) {
      clearTimeout(timeoutId); // Ensure timeout is cleared on error
      console.error('Fetch error:', err);
      
      if (err.name === 'AbortError') {
        setError('Connection timed out (15s). The school server took too long to respond. Please check if your ngrok tunnel is running and active.');
      } else {
        setError(err.message || 'Failed to fetch notifications. Please check your network connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch notifications on mount and set up automatic polling every 5 seconds
  useEffect(() => {
    // Check app version against server on startup
    checkAppVersion();

    // Initial fetch with full-screen loading spinner
    fetchNotifications(true);

    let timeoutId: ReturnType<typeof setTimeout>;
    let isPollingActive = true;

    const poll = async () => {
      if (!isPollingActive) return;
      await fetchNotifications(false);
      if (isPollingActive) {
        timeoutId = setTimeout(poll, 5000);
      }
    };

    const startPolling = () => {
      isPollingActive = true;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(poll, 5000);
    };

    const stopPolling = () => {
      isPollingActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Start background polling
    startPolling();

    // Pause polling when app is minimized/in background to preserve battery
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        // App is back in foreground: update immediately, then resume polling
        fetchNotifications(false);
        startPolling();
      } else {
        // App is hidden: pause timers
        stopPolling();
      }
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [fetchNotifications, checkAppVersion]);

  // Refresh notifications list when a push notification arrives in the foreground
  useEffect(() => {
    if (notification) {
      fetchNotifications(false);
    }
  }, [notification, fetchNotifications]);

  // Handle deep linking / card auto-expansion when a notification is clicked/tapped
  useEffect(() => {
    if (lastNotificationResponse) {
      const responseData = lastNotificationResponse.notification.request.content.data;
      if (responseData && typeof responseData === 'object') {
        const recordId = responseData.recordId;
        const categoryType = responseData.type;

        if (categoryType && typeof categoryType === 'string') {
          setSelectedCategory(categoryType);
        }

        if (recordId) {
          const idStr = String(recordId);
          fetchNotifications(false).then(() => {
            setExpandedIds(prev => ({ ...prev, [idStr]: true }));
            setReadIds(prev => ({ ...prev, [idStr]: true }));
          });
        }
      }
    }
  }, [lastNotificationResponse, fetchNotifications]);

  // Handle Pull to Refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(false);
  };

  // Derive notifications from raw data and read states dynamically
  const notifications: NotificationItem[] = useMemo(() => {
    // Filter rawNotifications to only include ones intended for the app (is_app === 1)
    const appNotifs = rawNotifications.filter(item => String(item.is_app) === '1');

    return appNotifs.map((item: any) => {
      const idStr = String(item.id);
      const isRead = !!readIds[idStr];
      return {
        id: idStr,
        category: (item.category || 'All') as CategoryType,
        title: item.title || 'No Title',
        titleHi: item.title || 'No Title',
        description: item.message || '',
        descriptionHi: item.message_hindi || item.message || '',
        time: formatTime(item.created_at),
        isUnread: !isRead,
        priority: (item.priority || 'Normal') as PriorityType,
        isFlashing: item.priority === 'Emergency' || item.priority === 'High',
      };
    });
  }, [rawNotifications, readIds]);

  // Handle Mark All as Read
  const handleMarkAllRead = () => {
    const newReadIds = { ...readIds };
    rawNotifications.forEach(item => {
      newReadIds[String(item.id)] = true;
    });
    setReadIds(newReadIds);
  };

  // Mark single item as read
  const handleMarkAsRead = (id: string) => {
    setReadIds(prev => ({ ...prev, [id]: true }));
  };

  // Toggle card expansion
  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
    
    // Automatically mark as read when expanded
    const isUnread = notifications.find(item => item.id === id)?.isUnread;
    if (isUnread) {
      handleMarkAsRead(id);
    }
  };

  // Set card active language
  const handleSetLanguage = (id: string, lang: 'en' | 'hi') => {
    setCardLanguages(prev => ({
      ...prev,
      [id]: lang,
    }));
  };

  // Filtered Notifications list
  const filteredNotifications = useMemo(() => {
    return notifications.filter(
      item => selectedCategory === 'All' || item.category === selectedCategory
    );
  }, [notifications, selectedCategory]);

  // Unread Count
  const unreadCount = useMemo(() => {
    return notifications.filter(item => item.isUnread).length;
  }, [notifications]);

  // Get icon and color scheme based on category
  const getCategoryDetails = (category: string) => {
    switch (category) {
      case 'Alerts':
        return {
          icon: 'exclamationmark.triangle.fill' as const,
          bgColor: isDark ? '#7f1d1d' : '#fef2f2',
          iconColor: isDark ? '#f87171' : '#dc2626',
        };
      case 'Academics':
        return {
          icon: 'book.closed.fill' as const,
          bgColor: isDark ? '#1e3a8a' : '#eff6ff',
          iconColor: isDark ? '#60a5fa' : '#2563eb',
        };
      case 'Payments':
        return {
          icon: 'creditcard.fill' as const,
          bgColor: isDark ? '#78350f' : '#fffbeb',
          iconColor: isDark ? '#fbbf24' : '#d97706',
        };
      case 'Events':
        return {
          icon: 'calendar' as const,
          bgColor: isDark ? '#4c1d95' : '#f5f3ff',
          iconColor: isDark ? '#a78bfa' : '#7c3aed',
        };
      case 'Examination':
        return {
          icon: 'doc.append' as const,
          bgColor: isDark ? '#14532d' : '#f0fdf4',
          iconColor: isDark ? '#4ade80' : '#16a34a',
        };
      case 'Homework':
        return {
          icon: 'doc.text.fill' as const,
          bgColor: isDark ? '#5c1d40' : '#fdf2f8',
          iconColor: isDark ? '#f472b6' : '#db2777',
        };
      case 'Holiday':
        return {
          icon: 'sun.max.fill' as const,
          bgColor: isDark ? '#431407' : '#fff7ed',
          iconColor: isDark ? '#fb923c' : '#ea580c',
        };
      case 'Transport':
        return {
          icon: 'bus.fill' as const,
          bgColor: isDark ? '#115e59' : '#f0fdfa',
          iconColor: isDark ? '#2dd4bf' : '#0d9488',
        };
      case 'Circular':
        return {
          icon: 'speaker.wave.3.fill' as const,
          bgColor: isDark ? '#3b0764' : '#faf5ff',
          iconColor: isDark ? '#c084fc' : '#9333ea',
        };
      case 'General':
        return {
          icon: 'bell.fill' as const,
          bgColor: isDark ? '#1e293b' : '#f8fafc',
          iconColor: isDark ? '#38bdf8' : '#0284c7', // Sky-400 / Sky-600
        };
      default:
        return {
          icon: 'bell.fill' as const,
          bgColor: isDark ? '#334155' : '#f1f5f9',
          iconColor: isDark ? '#94a3b8' : '#475569',
        };
    }
  };

  // Get color styles for the priority badges
  const getPriorityDetails = (priority: PriorityType) => {
    switch (priority) {
      case 'Emergency':
        return {
          label: 'Emergency',
          color: isDark ? '#fda4af' : '#e11d48',
          bg: isDark ? '#4c0519' : '#ffe4e6',
        };
      case 'High':
        return {
          label: 'High',
          color: isDark ? '#fed7aa' : '#ea580c',
          bg: isDark ? '#431407' : '#ffedd5',
        };
      case 'Low':
        return {
          label: 'Low',
          color: isDark ? '#cbd5e1' : '#475569',
          bg: isDark ? '#1e293b' : '#f1f5f9',
        };
      default: // Normal
        return {
          label: 'Normal',
          color: isDark ? '#bae6fd' : '#0284c7',
          bg: isDark ? '#0c4a6e' : '#e0f2fe',
        };
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? '#151718' : '#ffffff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#151718' : '#ffffff'} />
      <ThemedView style={styles.container}>
        
        {/* Watermark Background School Logo */}
        <View pointerEvents="none" style={styles.watermarkContainer}>
          <Image
            source={require('@/assets/images/global-minds-logo.png')}
            style={[
              styles.watermarkImage,
              { opacity: isDark ? 0.04 : 0.06 }
            ]}
            resizeMode="contain"
          />
        </View>

        {/* Custom Premium Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Pressable
              onPress={() => toggleDrawer(true)}
              style={({ pressed }) => [styles.menuButton, pressed ? styles.pressedState : undefined]}
            >
              <IconSymbol name="line.3.horizontal" size={24} color={isDark ? '#f8fafc' : '#0f172a'} />
            </Pressable>
            <View>
              <ThemedText type="title" style={styles.headerTitle}>School Updates</ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                {loading 
                  ? 'Checking for updates...' 
                  : unreadCount > 0 
                    ? `You have ${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` 
                    : 'No unread updates'}
              </ThemedText>
            </View>
          </View>
          {unreadCount > 0 && !loading && !error && (
            <Pressable 
              onPress={handleMarkAllRead}
              style={({ pressed }) => [styles.markReadButton, pressed ? styles.pressedState : undefined]}
            >
              <ThemedText style={[styles.markReadText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>Mark all read</ThemedText>
            </Pressable>
          )}
        </View>

        {/* Categories Bar */}
        <View style={styles.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {categories.map(category => {
              const isActive = selectedCategory === category;
              return (
                <Pressable
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={[
                    styles.categoryPill,
                    isActive 
                      ? (isDark ? styles.categoryPillActiveDark : styles.categoryPillActiveLight)
                      : (isDark ? styles.categoryPillInactiveDark : styles.categoryPillInactiveLight)
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.categoryPillText,
                      isActive 
                        ? (isDark ? { color: '#0f172a' } : styles.categoryTextActive)
                        : (isDark ? styles.categoryTextInactiveDark : styles.categoryTextInactiveLight)
                    ]}
                  >
                    {category}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Notifications list, Loading state, and Error state */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={isDark ? '#60a5fa' : '#2563eb'} />
            <ThemedText style={[styles.loadingText, { color: isDark ? '#94a3b8' : '#64748b' }]}>Fetching updates from school server...</ThemedText>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <View style={[styles.errorIconCircle, { backgroundColor: isDark ? '#3b1818' : '#fee2e2' }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={40} color={isDark ? '#f87171' : '#dc2626'} />
            </View>
            <ThemedText style={styles.errorTitle}>Failed to Load Updates</ThemedText>
            <ThemedText style={[styles.errorSubtitle, { color: isDark ? '#94a3b8' : '#475569' }]}>
              {error}
            </ThemedText>
            
            <View style={[styles.urlConfigBox, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
              <ThemedText style={[styles.urlConfigLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>API Endpoint:</ThemedText>
              <ThemedText style={[styles.urlConfigText, { color: isDark ? '#cbd5e1' : '#334155' }]} numberOfLines={2}>
                {API_CONFIG.API_URL}
              </ThemedText>
              <ThemedText style={[styles.urlConfigTip, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                You can change this API URL inside constants/config.ts
              </ThemedText>
            </View>
            
            <Pressable
              onPress={() => fetchNotifications(true)}
              style={({ pressed }) => [
                styles.retryButton,
                pressed ? styles.pressedState : undefined
              ]}
            >
              <ThemedText style={styles.retryButtonText}>Retry Fetching</ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView 
            style={styles.listContainer} 
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={[isDark ? '#60a5fa' : '#2563eb']}
                tintColor={isDark ? '#60a5fa' : '#2563eb'}
              />
            }
          >
            {filteredNotifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                  <IconSymbol name="bell" size={48} color={isDark ? '#64748b' : '#cbd5e1'} />
                </View>
                <ThemedText style={styles.emptyTitle}>All Clear!</ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  No notifications found in {selectedCategory === 'All' ? 'any category' : selectedCategory}.
                </ThemedText>
              </View>
            ) : (
              filteredNotifications.map(item => {
                const details = getCategoryDetails(item.category);
                const priorityDetails = getPriorityDetails(item.priority);
                const isExpanded = !!expandedIds[item.id];
                const activeLang = cardLanguages[item.id] || 'en';
                
                // Get localized title and description
                const localizedTitle = item.title;
                const localizedDescription = activeLang === 'hi' ? item.descriptionHi : item.description;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleToggleExpand(item.id)}
                    style={({ pressed }) => [
                      styles.card,
                      isDark ? styles.cardDark : styles.cardLight,
                      item.isUnread ? (isDark ? styles.cardUnreadDark : styles.cardUnreadLight) : undefined,
                      item.priority === 'Emergency' ? { borderColor: '#f43f5e', borderWidth: 1.5 } : undefined,
                      pressed ? styles.pressedStateCard : undefined,
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      {/* Circle Icon */}
                      <View style={[styles.iconCircle, { backgroundColor: details.bgColor }]}>
                        <IconSymbol name={details.icon} size={20} color={details.iconColor} />
                      </View>

                      {/* Meta info & Action */}
                      <View style={styles.cardHeaderRight}>
                        <View style={styles.metaRow}>
                          <View style={styles.badgeRow}>
                            <ThemedText style={[styles.categoryBadge, { color: details.iconColor }]}>
                              {item.category}
                            </ThemedText>
                            
                            {/* Priority Badge */}
                            <View style={[styles.priorityBadge, { backgroundColor: priorityDetails.bg }]}>
                              <ThemedText style={[styles.priorityBadgeText, { color: priorityDetails.color }]}>
                                {priorityDetails.label}
                              </ThemedText>
                            </View>

                            {/* Pulsing neon NEW badge */}
                            {item.isUnread && item.isFlashing && (
                              <Animated.View
                                style={[
                                  styles.neonBadge,
                                  {
                                    opacity: neonOpacity,
                                    transform: [{ scale: neonScale }],
                                  },
                                ]}
                              >
                                <ThemedText style={styles.neonBadgeText}>NEW</ThemedText>
                              </Animated.View>
                            )}
                          </View>
                          
                          {/* Time Row with clock icon */}
                          <View style={styles.timeContainer}>
                            <IconSymbol 
                              name="clock.fill" 
                              size={12} 
                              color={item.isUnread ? '#d97706' : '#64748b'}
                            />
                            <ThemedText style={[
                              styles.timeText,
                              item.isUnread ? styles.timeTextUnread : styles.timeTextRead,
                              { color: item.isUnread ? (isDark ? '#fbbf24' : '#b45309') : (isDark ? '#94a3b8' : '#64748b') }
                            ]}>
                              {item.time}
                            </ThemedText>
                          </View>
                        </View>
                        
                        <View style={styles.actionRow}>
                          {item.isUnread && <View style={[styles.unreadDot, { backgroundColor: details.iconColor }]} />}
                        </View>
                      </View>
                    </View>

                    <View style={styles.cardBody}>
                      <ThemedText style={[
                        styles.cardTitle,
                        item.isUnread ? styles.cardTitleUnread : styles.cardTitleRead,
                        { color: isDark ? '#f8fafc' : '#0f172a' }
                      ]}>
                        {localizedTitle}
                      </ThemedText>
                      
                      {/* Show toggle controls and bilingual contents when expanded */}
                      {isExpanded ? (
                        <View style={[styles.expandedContent, { borderTopColor: isDark ? '#334155' : '#e2e8f0' }]}>
                          {/* Language Selector Tabs */}
                          <View style={[styles.languageToggleContainer, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                handleSetLanguage(item.id, 'en');
                              }}
                              style={[
                                styles.langTabButton,
                                activeLang === 'en' 
                                  ? (isDark ? styles.langTabActiveDark : styles.langTabActiveLight)
                                  : styles.langTabInactive
                              ]}
                            >
                              <ThemedText style={[
                                styles.langTabText, 
                                activeLang === 'en' ? [styles.langTabTextActive, { color: isDark ? '#ffffff' : '#0f172a' }] : undefined
                              ]}>
                                English
                              </ThemedText>
                            </Pressable>
                            
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                handleSetLanguage(item.id, 'hi');
                              }}
                              style={[
                                styles.langTabButton,
                                activeLang === 'hi' 
                                  ? (isDark ? styles.langTabActiveDark : styles.langTabActiveLight)
                                  : styles.langTabInactive
                              ]}
                            >
                              <ThemedText style={[
                                styles.langTabText, 
                                activeLang === 'hi' ? [styles.langTabTextActive, { color: isDark ? '#ffffff' : '#0f172a' }] : undefined
                              ]}>
                                हिंदी (Hindi)
                              </ThemedText>
                            </Pressable>
                          </View>
                          
                          {/* Detailed Description */}
                          <ThemedText style={[
                            styles.cardDescriptionExpanded,
                            { color: isDark ? '#cbd5e1' : '#334155' }
                          ]}>
                            {localizedDescription}
                          </ThemedText>

                          {/* Visual helper to collapse */}
                          <Pressable 
                            onPress={(e) => {
                              e.stopPropagation();
                              handleToggleExpand(item.id);
                            }}
                            style={[styles.readCollapseButton, { borderColor: isDark ? '#475569' : '#cbd5e1' }]}
                          >
                            <ThemedText style={[styles.readCollapseText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                              Close Details
                            </ThemedText>
                          </Pressable>
                        </View>
                      ) : (
                        // Shorter snippet for collapsed state
                        <ThemedText 
                          numberOfLines={2} 
                          style={[
                            styles.cardDescription,
                            { color: isDark ? '#94a3b8' : '#475569' }
                          ]}
                        >
                          {localizedDescription}
                        </ThemedText>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Custom Slide-In Side Drawer Menu */}
        {isDrawerOpen && (
          <Modal
            visible={isDrawerOpen}
            transparent={true}
            animationType="none"
            onRequestClose={() => toggleDrawer(false)}
          >
            <View style={styles.drawerOverlay}>
              {/* Fade-in Backdrop */}
              <Pressable 
                style={styles.drawerBackdrop} 
                onPress={() => toggleDrawer(false)} 
              />
              
              {/* Slide-in Content Container */}
              <Animated.View 
                style={[
                  styles.drawerContent,
                  isDark ? styles.drawerContentDark : styles.drawerContentLight,
                  {
                    transform: [
                      {
                        translateX: drawerAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-300, 0], // slide from left
                        }),
                      },
                    ],
                  },
                ]}
              >
                {/* Drawer Header with School logo and title */}
                <View style={[styles.drawerHeader, { borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}>
                  <Image
                    source={require('@/assets/images/global-minds-logo.png')}
                    style={styles.drawerLogo}
                    resizeMode="contain"
                  />
                  <ThemedText style={styles.drawerSchoolName}>Global Minds</ThemedText>
                  <ThemedText style={[styles.drawerSchoolSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    School App Portal
                  </ThemedText>
                </View>

                {/* Drawer Menu List */}
                <ScrollView contentContainerStyle={styles.drawerList}>
                  {/* Menu Option: Notifications (Current/Active) */}
                  <Pressable
                    onPress={() => toggleDrawer(false)}
                    style={({ pressed }) => [
                      styles.drawerItem,
                      styles.drawerItemActive,
                      isDark ? styles.drawerItemActiveDark : styles.drawerItemActiveLight,
                      pressed ? styles.pressedState : undefined
                    ]}
                  >
                    <IconSymbol name="bell.fill" size={20} color={isDark ? '#0f172a' : '#0284c7'} />
                    <ThemedText style={[styles.drawerItemText, styles.drawerItemTextActive, { color: isDark ? '#0f172a' : '#0284c7' }]}>
                      Notifications
                    </ThemedText>
                    {unreadCount > 0 && (
                      <View style={styles.drawerBadge}>
                        <ThemedText style={styles.drawerBadgeText}>{unreadCount}</ThemedText>
                      </View>
                    )}
                  </Pressable>

                  {/* Menu Option: Mock Student Profile */}
                  <Pressable
                    onPress={() => {
                      toggleDrawer(false);
                    }}
                    style={({ pressed }) => [
                      styles.drawerItem,
                      pressed ? styles.pressedState : undefined
                    ]}
                  >
                    <IconSymbol name="person.fill" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    <ThemedText style={styles.drawerItemText}>Student Profile</ThemedText>
                  </Pressable>

                  {/* Menu Option: Mock Academics */}
                  <Pressable
                    onPress={() => {
                      toggleDrawer(false);
                    }}
                    style={({ pressed }) => [
                      styles.drawerItem,
                      pressed ? styles.pressedState : undefined
                    ]}
                  >
                    <IconSymbol name="book.closed.fill" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    <ThemedText style={styles.drawerItemText}>Academics</ThemedText>
                  </Pressable>

                  {/* Menu Option: Mock Payments */}
                  <Pressable
                    onPress={() => {
                      toggleDrawer(false);
                    }}
                    style={({ pressed }) => [
                      styles.drawerItem,
                      pressed ? styles.pressedState : undefined
                    ]}
                  >
                    <IconSymbol name="creditcard.fill" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    <ThemedText style={styles.drawerItemText}>Fee Payments</ThemedText>
                  </Pressable>

                  {/* Menu Option: Mock Settings */}
                  <Pressable
                    onPress={() => {
                      toggleDrawer(false);
                    }}
                    style={({ pressed }) => [
                      styles.drawerItem,
                      pressed ? styles.pressedState : undefined
                    ]}
                  >
                    <IconSymbol name="gearshape.fill" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    <ThemedText style={styles.drawerItemText}>App Settings</ThemedText>
                  </Pressable>

                  {/* Menu Option: Mock Info */}
                  <Pressable
                    onPress={() => {
                      toggleDrawer(false);
                    }}
                    style={({ pressed }) => [
                      styles.drawerItem,
                      pressed ? styles.pressedState : undefined
                    ]}
                  >
                    <IconSymbol name="info.circle.fill" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    <ThemedText style={styles.drawerItemText}>About School</ThemedText>
                  </Pressable>

                  {/* Menu Option: Check for Update */}
                  <Pressable
                    onPress={() => {
                      toggleDrawer(false);
                      setTimeout(() => {
                        checkAppVersion(true);
                      }, 300);
                    }}
                    style={({ pressed }) => [
                      styles.drawerItem,
                      pressed ? styles.pressedState : undefined
                    ]}
                  >
                    <IconSymbol name="arrow.down.circle.fill" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    <ThemedText style={styles.drawerItemText}>Check for Update</ThemedText>
                  </Pressable>
                </ScrollView>

                {/* Drawer Footer */}
                <View style={[styles.drawerFooter, { borderTopColor: isDark ? '#334155' : '#e2e8f0' }]}>
                  <ThemedText style={[styles.drawerVersionText, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                    App Version {Constants.expoConfig?.version || '1.0.0'}
                  </ThemedText>
                  {expoPushToken ? (
                    <Pressable
                      onPress={() => {
                        Alert.alert("Expo Push Token", expoPushToken, [{ text: "OK" }]);
                      }}
                      style={({ pressed }) => [pressed ? styles.pressedState : undefined]}
                    >
                      <ThemedText
                        numberOfLines={1}
                        ellipsizeMode="middle"
                        style={[styles.drawerVersionText, { color: isDark ? '#64748b' : '#94a3b8', fontSize: 10, marginTop: 4 }]}
                      >
                        Token: {expoPushToken}
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              </Animated.View>
            </View>
          </Modal>
        )}

        {/* Update App Modal Alert */}
        <Modal
          visible={showUpdateModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowUpdateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isDark ? styles.modalContentDark : styles.modalContentLight]}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: isDark ? '#1e293b' : '#e0f2fe' }]}>
                <IconSymbol name="arrow.down.circle.fill" size={36} color={isDark ? '#38bdf8' : '#0284c7'} />
              </View>
              <ThemedText style={styles.modalTitleText}>New Version Available</ThemedText>
              <ThemedText style={[styles.modalDescriptionText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                An updated version ({serverVersion}) of the app is available on the Play Store. Please update to enjoy the latest features and bug fixes.
              </ThemedText>
              <View style={styles.modalActionsRow}>
                <Pressable
                  onPress={() => setShowUpdateModal(false)}
                  style={({ pressed }) => [
                    styles.modalCancelButton,
                    isDark ? styles.modalCancelButtonDark : styles.modalCancelButtonLight,
                    pressed ? styles.pressedState : undefined
                  ]}
                >
                  <ThemedText style={[styles.modalCancelButtonText, { color: isDark ? '#cbd5e1' : '#475569' }]}>Later</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleUpdateApp}
                  style={({ pressed }) => [
                    styles.modalUpdateButton,
                    pressed ? styles.pressedState : undefined
                  ]}
                >
                  <ThemedText style={styles.modalUpdateButtonText}>Update Now</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTitle: {
    fontWeight: '800',
    fontSize: 28,
    lineHeight: 34,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  markReadButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  markReadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7', // sky-600
  },
  categoriesContainer: {
    marginVertical: 12,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryPillActiveLight: {
    backgroundColor: '#0f172a', // slate-900
    borderColor: '#0f172a',
  },
  categoryPillActiveDark: {
    backgroundColor: '#f1f5f9', // slate-100
    borderColor: '#f1f5f9',
  },
  categoryPillInactiveLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  categoryPillInactiveDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  categoryTextInactiveLight: {
    color: '#475569',
  },
  categoryTextInactiveDark: {
    color: '#94a3b8',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderColor: '#f1f5f9',
  },
  cardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderColor: '#334155',
  },
  cardUnreadLight: {
    backgroundColor: 'rgba(248, 250, 252, 0.88)',
    borderColor: '#bae6fd', // light sky border
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardUnreadDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderColor: '#0369a1', // dark sky border
  },
  pressedStateCard: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  pressedState: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priorityBadge: {
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  neonBadge: {
    backgroundColor: '#ff0055', // Flashing neon pink
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    shadowColor: '#ff0055',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  neonBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 11.5,
  },
  timeTextUnread: {
    fontWeight: '700',
  },
  timeTextRead: {
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardBody: {
    marginTop: 10,
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 22,
    marginBottom: 6,
  },
  cardTitleUnread: {
    fontWeight: '700',
  },
  cardTitleRead: {
    fontWeight: '500',
  },
  cardDescription: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  expandedContent: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  languageToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 4,
  },
  langTabButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  langTabActiveLight: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  langTabActiveDark: {
    backgroundColor: '#334155',
  },
  langTabInactive: {
    backgroundColor: 'transparent',
  },
  langTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  langTabTextActive: {
    fontWeight: '700',
    color: '#0f172a',
  },
  cardDescriptionExpanded: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  readCollapseButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  readCollapseText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7', // sky-600
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  urlConfigBox: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  urlConfigLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  urlConfigText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  urlConfigTip: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  retryButton: {
    backgroundColor: '#0284c7', // sky-600
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  modalContentDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  modalHeaderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitleText: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescriptionText: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  modalCancelButtonDark: {
    backgroundColor: 'transparent',
    borderColor: '#475569',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalUpdateButton: {
    flex: 1,
    backgroundColor: '#0284c7', // sky-600
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  modalUpdateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: -8,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  drawerContent: {
    width: 280,
    height: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
    paddingTop: 48,
    paddingHorizontal: 20,
    borderRightWidth: 1,
  },
  drawerContentLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  drawerContentDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  drawerHeader: {
    alignItems: 'center',
    paddingBottom: 24,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  drawerLogo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  drawerSchoolName: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  drawerSchoolSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  drawerList: {
    gap: 8,
    paddingBottom: 20,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  drawerItemActive: {
    // Overridden by theme variations
  },
  drawerItemActiveLight: {
    backgroundColor: '#eff6ff',
  },
  drawerItemActiveDark: {
    backgroundColor: '#f1f5f9',
  },
  drawerItemText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#64748b',
    flex: 1,
  },
  drawerItemTextActive: {
    fontWeight: '700',
  },
  drawerBadge: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  drawerFooter: {
    paddingVertical: 20,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerVersionText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  watermarkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  watermarkImage: {
    width: 300,
    height: 300,
  },
}) as any;
