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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_CONFIG } from '@/constants/config';

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
  
  // State variables for raw API response data and fetching lifecycle
  const [rawNotifications, setRawNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  // API Fetching logic (wrapped in useCallback for dependency safety)
  const fetchNotifications = useCallback(async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) {
      setLoading(true);
    }
    setError(null);
    
    // Create an AbortController to enforce a 6-second timeout limit
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 6000);

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
        setError('Connection timed out (6s). The school server took too long to respond. Please check if your ngrok tunnel is running and active.');
      } else {
        setError(err.message || 'Failed to fetch notifications. Please check your network connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? '#121212' : '#ffffff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ThemedView style={styles.container}>
        
        {/* Custom Premium Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View>
              <ThemedText type="title" style={styles.headerTitle}>School Updates</ThemedText>
              <ThemedText style={styles.headerSubtitle}>
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
              <ThemedText style={styles.markReadText}>Mark all read</ThemedText>
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
                        ? styles.categoryTextActive
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
            <ThemedText style={styles.loadingText}>Fetching updates from school server...</ThemedText>
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
                <ThemedText style={styles.emptySubtitle}>
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
                        <View style={styles.expandedContent}>
                          {/* Language Selector Tabs */}
                          <View style={styles.languageToggleContainer}>
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
                                activeLang === 'en' ? styles.langTabTextActive : undefined
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
                                activeLang === 'hi' ? styles.langTabTextActive : undefined
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
                            style={styles.readCollapseButton}
                          >
                            <ThemedText style={styles.readCollapseText}>
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
    backgroundColor: '#ffffff',
    borderColor: '#f1f5f9',
  },
  cardDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  cardUnreadLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#bae6fd', // light sky border
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardUnreadDark: {
    backgroundColor: '#1e293b',
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
}) as any;
