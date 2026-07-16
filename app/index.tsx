import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  StatusBar,
  useColorScheme,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Define the notification types and interfaces
type CategoryType = 'All' | 'Academics' | 'Events' | 'Alerts' | 'Payments';

interface NotificationItem {
  id: string;
  category: CategoryType;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  time: string;
  isUnread: boolean;
  isFlashing?: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    category: 'Alerts',
    title: 'Emergency: Heavy Rain Alert & Holiday',
    titleHi: 'आपातकालीन घोषणा: भारी बारिश का अलर्ट और छुट्टी',
    description: 'Due to the weather department forecast of extremely heavy rainfall, the school will remain closed tomorrow. Online classes will be conducted as per schedule. Please keep safe.',
    descriptionHi: 'मौसम विभाग द्वारा अत्यधिक भारी बारिश के पूर्वानुमान के कारण कल स्कूल बंद रहेगा। ऑनलाइन कक्षाएं निर्धारित समय के अनुसार संचालित की जाएंगी। कृपया सुरक्षित रहें।',
    time: '5 mins ago',
    isUnread: true,
    isFlashing: true, // Flashing neon badge!
  },
  {
    id: '2',
    category: 'Academics',
    title: 'Exam Schedule Released',
    titleHi: 'परीक्षा समय सारणी जारी',
    description: 'The mid-term exam schedule for all grades has been published. Exams will commence from September 14, 2026. Please check your student portal for class-specific timings.',
    descriptionHi: 'सभी कक्षाओं के लिए मध्य-सत्र परीक्षा की समय सारणी जारी कर दी गई है। परीक्षाएं 14 सितंबर, 2026 से शुरू होंगी। कृपया अपनी कक्षा के विशिष्ट समय के लिए छात्र पोर्टल की जांच करें।',
    time: '2 hours ago',
    isUnread: true,
  },
  {
    id: '3',
    category: 'Alerts',
    title: 'Attendance Alert',
    titleHi: 'उपस्थिति चेतावनी',
    description: 'Your ward has been marked absent for the morning session today. If this is an error or if you wish to apply for leave, please submit a request through the portal.',
    descriptionHi: 'आपके बच्चे को आज सुबह के सत्र में अनुपस्थित अंकित किया गया है। यदि यह कोई त्रुटि है या यदि आप छुट्टी के लिए आवेदन करना चाहते हैं, तो कृपया पोर्टल के माध्यम से अनुरोध सबमिट करें।',
    time: '4 hours ago',
    isUnread: true,
  },
  {
    id: '4',
    category: 'Payments',
    title: 'Tuition Fee Due Reminder',
    titleHi: 'ट्यूशन फीस भुगतान अनुस्मारक',
    description: 'This is a gentle reminder that the second quarter tuition fee is due on or before August 1st, 2026. Online payments can be made securely via the School App.',
    descriptionHi: 'यह एक विनम्र अनुस्मारक है कि दूसरी तिमाही की ट्यूशन फीस 1 अगस्त, 2026 या उससे पहले देय है। स्कूल ऐप के माध्यम से सुरक्षित रूप से ऑनलाइन भुगतान किया जा सकता है।',
    time: '1 day ago',
    isUnread: true,
  },
  {
    id: '5',
    category: 'Events',
    title: 'Annual Sports Meet 2026',
    titleHi: 'वार्षिक खेलकूद प्रतियोगिता 2026',
    description: 'Registration for the track and field events is now open! Please consult with the Physical Education department to sign up. Event scheduled for October 10.',
    descriptionHi: 'ट्रैक और फील्ड स्पर्धाओं के लिए पंजीकरण अब खुला है! कृपया साइन अप करने के लिए शारीरिक शिक्षा विभाग से संपर्क करें। प्रतियोगिता 10 अक्टूबर को निर्धारित है।',
    time: '2 days ago',
    isUnread: true,
  },
  {
    id: '6',
    category: 'Academics',
    title: 'Mathematics Assignment 4',
    titleHi: 'गणित असाइनमेंट 4',
    description: 'Mr. Sharma has posted Mathematics Assignment 4: Quadratic Equations. The submission deadline is Friday, July 24, at 4:00 PM.',
    descriptionHi: 'श्री शर्मा ने गणित असाइनमेंट 4: द्विघात समीकरण (Quadratic Equations) पोस्ट किया है। जमा करने की अंतिम तिथि शुक्रवार, 24 जुलाई, शाम 4:00 बजे है।',
    time: '3 days ago',
    isUnread: false,
  },
  {
    id: '7',
    category: 'Events',
    title: 'Parent-Teacher Interaction',
    titleHi: 'अभिभावक-शिक्षक बैठक',
    description: 'The monthly Parent-Teacher Meeting (PTM) is scheduled for this Saturday from 9:00 AM to 1:00 PM. High school meetings will be in Block A classrooms.',
    descriptionHi: 'मासिक अभिभावक-शिक्षक बैठक (PTM) इस शनिवार को सुबह 9:00 बजे से दोपहर 1:00 बजे तक निर्धारित है। हाई स्कूल की बैठकें ब्लॉक ए के क्लासरूम में होंगी।',
    time: '5 days ago',
    isUnread: false,
  },
  {
    id: '8',
    category: 'Alerts',
    title: 'School Closed Tomorrow',
    titleHi: 'कल स्कूल बंद रहेगा',
    description: 'Please note that the school will remain closed tomorrow on account of the state gazetted holiday. Regular online portal services will remain active.',
    descriptionHi: 'कृपया ध्यान दें कि राज्य राजपत्रित अवकाश के कारण कल स्कूल बंद रहेगा। नियमित ऑनलाइन पोर्टल सेवाएं सक्रिय रहेंगी।',
    time: '1 week ago',
    isUnread: false,
  },
];

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All');
  
  // Track expanded cards. ID '1' (first card) is expanded by default to draw parents' attention.
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({ '1': true });
  // Track active language for each card. Default to English ('en')
  const [cardLanguages, setCardLanguages] = useState<Record<string, 'en' | 'hi'>>({});

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

  const categories: CategoryType[] = ['All', 'Academics', 'Events', 'Alerts', 'Payments'];

  // Handle Mark All as Read
  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(item => ({ ...item, isUnread: false })));
  };

  // Toggle Single Read/Unread
  const handleToggleRead = (id: string) => {
    setNotifications(prev =>
      prev.map(item => (item.id === id ? { ...item, isUnread: !item.isUnread } : item))
    );
  };

  // Toggle card expansion
  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Set card active language
  const handleSetLanguage = (id: string, lang: 'en' | 'hi') => {
    setCardLanguages(prev => ({
      ...prev,
      [id]: lang,
    }));
  };



  // Filtered Notifications list
  const filteredNotifications = notifications.filter(
    item => selectedCategory === 'All' || item.category === selectedCategory
  );

  // Unread Count
  const unreadCount = notifications.filter(item => item.isUnread).length;

  // Get icon and color scheme based on category
  const getCategoryDetails = (category: CategoryType) => {
    switch (category) {
      case 'Academics':
        return {
          icon: 'book.closed.fill' as const,
          bgColor: isDark ? '#1e3a8a' : '#eff6ff',
          iconColor: isDark ? '#60a5fa' : '#2563eb',
        };
      case 'Events':
        return {
          icon: 'calendar' as const,
          bgColor: isDark ? '#4c1d95' : '#f5f3ff',
          iconColor: isDark ? '#a78bfa' : '#7c3aed',
        };
      case 'Alerts':
        return {
          icon: 'exclamationmark.triangle.fill' as const,
          bgColor: isDark ? '#7f1d1d' : '#fef2f2',
          iconColor: isDark ? '#f87171' : '#dc2626',
        };
      case 'Payments':
        return {
          icon: 'creditcard.fill' as const,
          bgColor: isDark ? '#78350f' : '#fffbeb',
          iconColor: isDark ? '#fbbf24' : '#d97706',
        };
      default:
        return {
          icon: 'bell.fill' as const,
          bgColor: isDark ? '#334155' : '#f1f5f9',
          iconColor: isDark ? '#94a3b8' : '#475569',
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
                {unreadCount > 0 ? `You have ${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'No unread updates'}
              </ThemedText>
            </View>
          </View>
          {unreadCount > 0 && (
            <Pressable 
              onPress={handleMarkAllRead}
              style={({ pressed }) => [styles.markReadButton, pressed && styles.pressedState]}
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

        {/* Notifications List */}
        <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
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
              const isExpanded = !!expandedIds[item.id];
              const activeLang = cardLanguages[item.id] || 'en';
              
              // Get localized title and description
              const localizedTitle = activeLang === 'hi' ? item.titleHi : item.title;
              const localizedDescription = activeLang === 'hi' ? item.descriptionHi : item.description;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleToggleExpand(item.id)}
                  style={({ pressed }) => [
                    styles.card,
                    isDark ? styles.cardDark : styles.cardLight,
                    item.isUnread && (isDark ? styles.cardUnreadDark : styles.cardUnreadLight),
                    pressed && styles.pressedStateCard,
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
                          {/* Pulsing neon NEW badge */}
                          {item.isFlashing && (
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
                        
                        {/* Time Row with clock icon, styled to attract parents */}
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
                              activeLang === 'en' && styles.langTabTextActive
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
                              activeLang === 'hi' && styles.langTabTextActive
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
                            handleToggleRead(item.id); // Mark as read on collapse/reading
                          }}
                          style={styles.readCollapseButton}
                        >
                          <ThemedText style={styles.readCollapseText}>
                            {item.isUnread ? 'Mark as read & close' : 'Close Details'}
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
    gap: 8,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  neonBadge: {
    backgroundColor: '#ff0055', // Flashing neon pink
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    shadowColor: '#ff0055',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  neonBadgeText: {
    color: '#ffffff',
    fontSize: 9,
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
});
