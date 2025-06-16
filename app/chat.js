import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Modal, Pressable, ActivityIndicator, Animated, Vibration, TouchableWithoutFeedback, Image, Share } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import io from 'socket.io-client';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import Voice from '@react-native-voice/voice'; 

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'as', label: 'Assamese' },
  { code: 'bn', label: 'Bengali' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ur', label: 'Urdu' },
];

// Improved translation function with better error handling and caching
const translationCache = {};

async function translateText(text, fromLang, toLang) {
  if (!text || fromLang === toLang) return text;
  
  // Check cache first
  const cacheKey = `${fromLang}:${toLang}:${text}`;
  if (translationCache[cacheKey]) {
    console.log('Using cached translation');
    return translationCache[cacheKey];
  }
  
  try {
    console.log(`Translating from ${fromLang} to ${toLang}: "${text}"`);
    const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }
    
    const result = await response.json();
    if (!result || !result[0]) {
      throw new Error('Invalid translation response');
    }
    
    const translated = result[0]
      .map(item => item && item[0])
      .filter(Boolean)
      .join('');
    
    // Store in cache
    translationCache[cacheKey] = translated;
    return translated;
  } catch (e) {
    console.error(`Translation error: ${e.message}`, e);
    return text; // Return original text on failure
  }
}

function getTimeDisplay(timestamp) {
  if (!timestamp) return '';
  const messageDate = new Date(timestamp);
  const today = new Date();
  
  // Same day - show time only
  if (messageDate.toDateString() === today.toDateString()) {
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Yesterday
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (messageDate.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Within last week - show day name
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);
  if (messageDate > lastWeek) {
    return `${messageDate.toLocaleDateString([], { weekday: 'short' })} ${messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Older - show date
  return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatScreen() {
  const { userId, userName } = useLocalSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [language, setLanguage] = useState('en');
  const [languageModal, setLanguageModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [typingStatus, setTypingStatus] = useState('');
  const [messageContextMenu, setMessageContextMenu] = useState({ visible: false, messageId: null, x: 0, y: 0 });
  const [dateHeaders, setDateHeaders] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [imagePreview, setImagePreview] = useState(null);
  const [messageToForward, setMessageToForward] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const typingAnimation = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const socketRef = useRef();
  const flatListRef = useRef();
  const mySocketId = useRef(null);
  const searchBarHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log("Connecting to socket...");
    socketRef.current = io('http://192.168.31.55:3000', {
      transports: ['websocket'],
      reconnection: true,
      timeout: 10000
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log("Socket connected with ID:", socket.id);
      mySocketId.current = socket.id;
      setConnectionStatus('connected');
      socket.emit('user_join', {
        name: userName || 'User',
        username: userName || 'User',
        preferredLanguage: language
      });
    });

    socket.on('disconnect', () => {
      console.log("Socket disconnected");
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error("Connection error:", error);
      setConnectionStatus('error');
    });

    socket.on('receive_message', async (msg) => {
      console.log('Received message:', msg);
      
      // FIX 2: Properly check if message is from self
      // Store a proper ID reference for the current user
      const isFromMe = msg.senderId === mySocketId.current;
      console.log(`Message sender: ${msg.senderId}, My ID: ${mySocketId.current}, Is mine: ${isFromMe}`);
      
      try {
        // Extract message data
        const messageText = msg.originalText || msg.message || '';
        const sourceLang = msg.sourceLanguage || 'en';
        
        // Always try to translate if languages are different
        let translatedText = messageText;
        let wasTranslated = false;
        
        if (sourceLang !== language && messageText) {
          translatedText = await translateText(messageText, sourceLang, language);
          wasTranslated = translatedText !== messageText && translatedText !== '';
          
          // Log success or failure
          if (wasTranslated) {
            console.log(`Translation success from ${sourceLang} to ${language}:`, translatedText);
          } else {
            console.warn(`Translation might have failed - result same as original`);
          }
        }
        
        // Add message to state with translation info and correct sender information
        setMessages(prevMessages => [
          ...prevMessages,
          {
            ...msg,
            senderId: msg.senderId, // Ensure the ID is preserved
            translatedText,
            wasTranslated,
            sourceLang,
            isMine: isFromMe // Add explicit flag for rendering
          }
        ]);
      } catch (error) {
        console.error('Error handling received message:', error);
        // Still add the message even if translation fails
        setMessages(prevMessages => [
          ...prevMessages,
          {
            ...msg,
            senderId: msg.senderId,
            translatedText: msg.message,
            wasTranslated: false,
            isMine: isFromMe
          }
        ]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [userName, language]);

  // Add this effect to handle reconnection logic
  useEffect(() => {
    // Try to reconnect if status is error or disconnected
    if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
      const reconnectTimer = setTimeout(() => {
        console.log("Attempting to reconnect...");
        if (socketRef.current) {
          socketRef.current.connect();
        }
      }, 3000);
      
      return () => clearTimeout(reconnectTimer);
    }
  }, [connectionStatus]);

  // Add this effect to group messages by date
  useEffect(() => {
    // Group messages by date for headers
    const groupedByDate = {};
    messages.forEach(msg => {
      if (msg.timestamp) {
        const date = new Date(msg.timestamp).toDateString();
        if (!groupedByDate[date]) {
          groupedByDate[date] = [];
        }
        groupedByDate[date].push(msg);
      }
    });
    setDateHeaders(Object.keys(groupedByDate));
    
    // Auto-start animation for typing
    Animated.loop(
      Animated.sequence([
        Animated.timing(typingAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.timing(typingAnimation, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        })
      ])
    ).start();
  }, [messages]);

  const sendMessage = () => {
    if (!message.trim()) return;
    if (connectionStatus !== 'connected') {
      alert('You are currently offline. Please wait for reconnection.');
      return;
    }
    
    setMessageLoading(true);
    
    // When sending, always include clear language information
    const messageId = Date.now().toString();
    const messageToSend = {
      id: messageId,
      message: message.trim(),
      originalText: message.trim(),
      sourceLanguage: language,
      timestamp: new Date().toISOString(),
      // Add sender ID explicitly to help with identification
      senderId: mySocketId.current
    };
    
    console.log(`Sending message in ${language} with ID ${mySocketId.current}:`, messageToSend);
    
    // Add message to local state immediately for better UX
    setMessages(prevMessages => [
      ...prevMessages,
      {
        ...messageToSend,
        isMine: true,
        pending: true
      }
    ]);
    
    socketRef.current.emit('send_message', messageToSend, (ack) => {
      // Update message status when acknowledged
      if (ack && ack.success) {
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === messageId ? { ...msg, pending: false, delivered: true } : msg
          )
        );
      }
    });
    
    setMessage('');
    
    // Simulate sending delay for better UX
    setTimeout(() => {
      setMessageLoading(false);
    }, 500);
  };

  // Add a function to handle pull-to-refresh
  const handleRefresh = () => {
    setRefreshing(true);
    // Reconnect to socket or reload messages
    if (socketRef.current) {
      if (!socketRef.current.connected) {
        socketRef.current.connect();
      } else {
        // Request latest messages
        socketRef.current.emit('get_recent_messages');
      }
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setLanguageModal(false);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('language_change', { language: lang });
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Initialize voice recognition handlers
      Voice.onSpeechStart = () => {
        console.log('Speech recognition started');
      };
      
      Voice.onSpeechEnd = () => {
        console.log('Speech recognition ended');
        setIsRecording(false);
      };
      
      Voice.onSpeechResults = (event) => {
        if (event.value && event.value.length > 0) {
          const recognizedText = event.value[0];
          console.log('Speech recognition result:', recognizedText);
          setMessage(recognizedText);
        }
      };
      
      Voice.onSpeechError = (error) => {
        console.error('Speech recognition error:', error);
        setIsRecording(false);
      };
      
      // Clean up listeners when component unmounts
      return () => {
        Voice.destroy().then(() => {
          console.log('Voice recognition destroyed');
        });
      };
    }
  }, []);

  const startSpeechToText = async () => {
    try {
      setIsRecording(true);
      
      // Web Speech API implementation - this part works on web browsers
      if (Platform.OS === 'web') {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          
          // Match language code to speech recognition code
          const speechLang = {
            'en': 'en-US',
            'hi': 'hi-IN',
            'bn': 'bn-IN',
            'gu': 'gu-IN',
            'kn': 'kn-IN',
            'ml': 'ml-IN',
            'mr': 'mr-IN',
            'ta': 'ta-IN',
            'te': 'te-IN',
            'ur': 'ur-IN'
          };
          
          recognition.lang = speechLang[language] || 'en-US';
          recognition.continuous = false;
          recognition.interimResults = false;
          
          recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setMessage(transcript);
            setIsRecording(false);
          };
          
          recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsRecording(false);
          };
          
          recognition.onend = () => {
            setIsRecording(false);
          };
          
          recognition.start();
        } else {
          alert('Speech recognition is not supported in this browser.');
          setIsRecording(false);
        }
      } else {
        // For mobile, we just show an alert since we don't have the correct package
        alert('Speech recognition for mobile requires @react-native-voice/voice package.\n\nRun: npx expo install @react-native-voice/voice');
        setIsRecording(false);
      }
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsRecording(false);
    }
  };

  const stopSpeechToText = async () => {
    if (Platform.OS === 'web') {
      // Web speech doesn't need explicit stop usually
      setIsRecording(false);
    } else {
      // Stop mobile voice recognition
      try {
        await Voice.stop();
        setIsRecording(false);
      } catch (error) {
        console.error('Failed to stop voice recognition:', error);
        setIsRecording(false);
      }
    }
  };

  const renderLanguageModal = () => (
    <Modal
      visible={languageModal}
      transparent
      animationType="slide"
      onRequestClose={() => setLanguageModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select your language</Text>
          {LANGUAGES.map(lang => (
            <Pressable
              key={lang.code}
              style={[
                styles.languageOption,
                language === lang.code && styles.languageOptionSelected
              ]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text style={[
                styles.languageOptionText,
                language === lang.code && styles.languageOptionTextSelected
              ]}>
                {lang.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );

  const renderDateHeader = (date) => {
    return (
      <View key={date} style={styles.dateHeader}>
        <View style={styles.dateHeaderLine} />
        <Text style={styles.dateHeaderText}>{new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
        <View style={styles.dateHeaderLine} />
      </View>
    );
  };

  const onTyping = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing', { userId });
    }
  };
  
  const toggleSearch = () => {
    if (showSearchBar) {
      Animated.timing(searchBarHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false
      }).start(() => {
        setShowSearchBar(false);
        setSearchQuery('');
      });
    } else {
      setShowSearchBar(true);
      Animated.timing(searchBarHeight, {
        toValue: 50,
        duration: 200,
        useNativeDriver: false
      }).start();
    }
  };

  const searchMessages = (query) => {
    setSearchQuery(query);
    if (!query) return;
    
    // Could implement highlighting and scrolling to matches
    const foundIndex = messages.findIndex(
      m => (m.translatedText || m.message || '').toLowerCase().includes(query.toLowerCase())
    );
    
    if (foundIndex >= 0) {
      flatListRef.current?.scrollToIndex({ index: foundIndex, animated: true });
    }
  };

  const toggleMessageSelection = (messageId) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedMessages([messageId]);
      return;
    }
    
    setSelectedMessages(prev => {
      if (prev.includes(messageId)) {
        const newSelected = prev.filter(id => id !== messageId);
        if (newSelected.length === 0) {
          setIsSelectionMode(false);
        }
        return newSelected;
      } else {
        return [...prev, messageId];
      }
    });
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMessages([]);
  };

  const deleteSelectedMessages = () => {
    // Here you'd send a delete request to the server
    setMessages(prev => prev.filter(msg => !selectedMessages.includes(msg.id)));
    cancelSelection();
  };

  const forwardMessage = (message) => {
    setMessageToForward(null);
    // Here you would normally open user selection UI
    Share.share({
      message: message.translatedText || message.message || '',
      title: 'Forward message'
    });
  };

  const handleAttachment = async () => {
    alert('This would open image picker, document selector, etc.');
    // Implement file picking here
  };

  // Enhance the existing context menu handler
  const handleMessageLongPress = (item, event) => {
    Vibration.vibrate(50);
    
    if (isSelectionMode) {
      toggleMessageSelection(item.id);
      return;
    }
    
    setMessageContextMenu({
      visible: true,
      messageId: item.id,
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
      message: item
    });
  };

  // Add more actions to the menu
  const enhancedMessageContextMenu = () => {
    if (!messageContextMenu.visible) return null;
    
    const isMine = messageContextMenu.message?.isMine || 
                  messageContextMenu.message?.senderId === mySocketId.current;
    
    return (
      <View style={[
        styles.messageContextMenu,
        {
          top: messageContextMenu.y - 100,
          left: messageContextMenu.x - 75,
        }
      ]}>
        <TouchableOpacity 
          style={styles.contextMenuItem}
          onPress={() => copyMessage(messageContextMenu.message?.translatedText || messageContextMenu.message?.message)}
        >
          <Ionicons name="copy-outline" size={16} color="#22577A" />
          <Text style={styles.contextMenuItemText}>Copy</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.contextMenuItem}
          onPress={() => {
            setMessageContextMenu({ visible: false });
            setMessageToForward(messageContextMenu.message);
            forwardMessage(messageContextMenu.message);
          }}
        >
          <Ionicons name="arrow-redo-outline" size={16} color="#22577A" />
          <Text style={styles.contextMenuItemText}>Forward</Text>
        </TouchableOpacity>
        
        {isMine && (
          <TouchableOpacity 
            style={styles.contextMenuItem}
            onPress={() => {
              setMessages(prev => prev.filter(m => m.id !== messageContextMenu.messageId));
              setMessageContextMenu({ visible: false });
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#FF3366" />
            <Text style={styles.contextMenuItemText}>Delete</Text>
          </TouchableOpacity>
        )}
        
        {!isMine && (
          <TouchableOpacity 
            style={styles.contextMenuItem}
            onPress={() => reportMessage(messageContextMenu.messageId)}
          >
            <Ionicons name="flag-outline" size={16} color="#FF3366" />
            <Text style={styles.contextMenuItemText}>Report</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Enhance renderMessage to support more features
  const renderMessage = ({ item }) => {
    // FIX 2: Use the isMine property set when receiving/sending messages
    // or fall back to comparing with socketRef.current.id
    const isMine = item.isMine || item.senderId === mySocketId.current;
    
    console.log(`Rendering message: ${item.id}, senderId: ${item.senderId}, isMine: ${isMine}`);
    
    // Clear logic for showing translations
    const showTranslation = item.wasTranslated && 
                           item.translatedText && 
                           item.translatedText !== item.originalText && 
                           item.translatedText !== item.message;
    
    // Choose what text to display                       
    const displayText = showTranslation ? item.translatedText : (item.originalText || item.message || '');
    
    return (
      <TouchableWithoutFeedback
        onLongPress={(e) => handleMessageLongPress(item, e)}
        onPress={() => {
          if (isSelectionMode) {
            toggleMessageSelection(item.id);
          }
        }}
      >
        <View style={[
          styles.messageContainer, 
          isMine ? styles.myMessage : styles.theirMessage,
          item.pending && styles.pendingMessage,
          selectedMessages.includes(item.id) && styles.selectedMessage
        ]}>
          {isSelectionMode && (
            <View style={styles.selectionIndicator}>
              <Ionicons 
                name={selectedMessages.includes(item.id) ? "checkmark-circle" : "ellipse-outline"} 
                size={20} 
                color={selectedMessages.includes(item.id) ? "#57A6FF" : "#B5D3EC"} 
              />
            </View>
          )}
          
          {!isMine && (
            <Text style={styles.senderName}>{item.senderName || 'Anonymous'}</Text>
          )}
          
          {/* Handle different content types */}
          {item.contentType === 'image' && item.imageUrl && (
            <TouchableOpacity 
              onPress={() => setImagePreview(item.imageUrl)}
              style={styles.imageContainer}
            >
              <Image 
                source={{ uri: item.imageUrl }} 
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          
          {/* Regular text message */}
          {(!item.contentType || item.contentType === 'text') && (
            <Text style={[styles.messageText, isMine ? styles.myMessageText : styles.theirMessageText]}>
              {displayText}
            </Text>
          )}
          
          {showTranslation && (
            <View style={styles.translationContainer}>
              <Ionicons name="language" size={12} color="#7FB5E8" style={styles.translationIcon} />
              <Text style={styles.translationNote}>
                (Translated from {LANGUAGES.find(l => l.code === (item.sourceLanguage || 'en'))?.label || item.sourceLanguage})
              </Text>
            </View>
          )}
          
          {/* Reply indicator for messages that are replies */}
          {item.replyTo && (
            <View style={styles.replyContainer}>
              <Ionicons name="return-up-back" size={12} color="#7FB5E8" />
              <Text style={styles.replyText} numberOfLines={1} ellipsizeMode="tail">
                {item.replyToText || 'Original message'}
              </Text>
            </View>
          )}
          
          {/* Message status with more detailed indicators */}
          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>
              {getTimeDisplay(item.timestamp)}
            </Text>
            {isMine && (
              <Ionicons 
                name={
                  item.pending ? "time-outline" :
                  item.delivered ? "checkmark-done" : 
                  item.sent ? "checkmark" : "alert-circle-outline"
                } 
                size={14} 
                color={
                  item.pending ? "#B5D3EC" :
                  item.read ? "#57A6FF" : 
                  item.delivered ? "#7FB5E8" : 
                  "#B5D3EC"
                } 
              />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  // Add this for image preview modal
  const renderImagePreview = () => {
    if (!imagePreview) return null;
    
    return (
      <Modal
        visible={!!imagePreview}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImagePreview(null)}
      >
        <View style={styles.imagePreviewContainer}>
          <TouchableOpacity 
            style={styles.imagePreviewCloseButton}
            onPress={() => setImagePreview(null)}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          <Image 
            source={{ uri: imagePreview }} 
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    );
  };

  // Fix the animation setup - add a useEffect that runs once on mount
  useEffect(() => {
    // Start the typing animation loop (only once)
    Animated.loop(
      Animated.sequence([
        Animated.timing(typingAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.timing(typingAnimation, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        })
      ])
    ).start();
  }, []); // Empty dependency array means run once on mount

  // Fix headers layout
  const fixHeaderLayout = () => {
    return (
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => isSelectionMode ? cancelSelection() : router.back()}
          style={styles.backButton}
        >
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color="#22577A" 
          />
        </TouchableOpacity>

        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>
              {userName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{userName}</Text>
            <View style={styles.onlineStatus}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };
  
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Modals */}
      {renderLanguageModal()}
      {renderImagePreview()}
      
      {/* Fix the header */}
      {fixHeaderLayout()}

      {/* Connection banner - fix position */}
      {connectionStatus !== 'connected' && (
        <View style={styles.connectionBanner}>
          <Text style={styles.connectionText}>
            {connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
          </Text>
        </View>
      )}

      {/* Search bar - fix animation and position */}
      {showSearchBar && (
        <Animated.View style={[styles.searchBarContainer, { height: searchBarHeight }]}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#7FB5E8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search messages..."
              placeholderTextColor="#7FB5E8"
              value={searchQuery}
              onChangeText={searchMessages}
              autoFocus
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#7FB5E8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.View>
      )}

      {/* Context menu - only render one version */}
      {enhancedMessageContextMenu()}
      
      {/* Backdrop for dismissing context menu */}
      {messageContextMenu.visible && (
        <TouchableWithoutFeedback onPress={() => setMessageContextMenu({ visible: false })}>
          <View style={styles.contextMenuBackdrop} />
        </TouchableWithoutFeedback>
      )}

      {/* Message list */}
      <Animated.FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={60} color="#B5D3EC" />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start a conversation!</Text>
          </View>
        }
        ListHeaderComponent={() => (
          <View>
            {dateHeaders.length > 0 && renderDateHeader(dateHeaders[0])}
          </View>
        )}
      />
      
      {/* Jump to bottom button - shows when scrolled up */}
      <Animated.View 
        style={[
          styles.scrollToBottom,
          {
            opacity: scrollY.interpolate({
              inputRange: [0, 200],
              outputRange: [0, 1],
              extrapolate: 'clamp'
            })
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.scrollToBottomButton}
          onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
        >
          <Ionicons name="chevron-down" size={24} color="#22577A" />
        </TouchableOpacity>
      </Animated.View>

      {/* Enhanced typing indicator */}
      <View style={styles.typingIndicator}>
        {typingStatus ? (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>{typingStatus}</Text>
            <View style={styles.typingDots}>
              <Animated.View 
                style={[
                  styles.typingDot,
                  { opacity: typingAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.typingDot,
                  { opacity: typingAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.typingDot,
                  { opacity: typingAnimation }
                ]} 
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* Enhanced input section */}
      <View style={styles.inputContainer}>
        {connectionStatus !== 'connected' && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>Offline</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.languageButtonCompact}
          onPress={() => setLanguageModal(true)}
        >
          <Text style={styles.languageCode}>
            {language.toUpperCase()}
          </Text>
        </TouchableOpacity>
        
        {/* Add attachment button */}
        <TouchableOpacity
          style={styles.attachButton}
          onPress={() => alert("Attachment feature would go here!")}
        >
          <Ionicons name="attach" size={22} color="#22577A" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          onPress={isRecording ? stopSpeechToText : startSpeechToText}
        >
          <FontAwesome 
            name={isRecording ? "stop-circle" : "microphone"} 
            size={20} 
            color={isRecording ? "#FF3366" : "#22577A"} 
          />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          placeholderTextColor="#666"
          multiline
        />
        
        <TouchableOpacity 
          style={[
            styles.sendButton,
            messageLoading && styles.sendingButton,
            !message.trim() && styles.disabledSendButton
          ]} 
          onPress={sendMessage}
          disabled={!message.trim() || messageLoading}
        >
          {messageLoading ? (
            <View style={styles.loadingDot} />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF4FB', // lighter blue background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    paddingHorizontal: 15,
    backgroundColor: '#F4FBFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#57A6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22577A',
    marginBottom: 2,
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  onlineText: {
    fontSize: 13,
    color: '#4CAF50',
  },
  messagesList: {
    padding: 15,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    padding: 12,
    borderRadius: 20,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#57A6FF', // blue accent
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F4FBFF', // very light blue
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#22577A',
  },
  timestamp: {
    fontSize: 12,
    color: '#7FB5E8',
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F4FBFF',
  },
  input: {
    flex: 1,
    backgroundColor: '#EAF4FB',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#22577A',
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: '#57A6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendingButton: {
    backgroundColor: '#B5D3EC',
  },
  disabledSendButton: {
    backgroundColor: '#B5D3EC',
    opacity: 0.7,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  senderName: {
    fontSize: 12,
    color: '#ccc',
    marginBottom: 4,
  },
  languageButtonCompact: {
    backgroundColor: '#57A6FF',
    borderRadius: 50,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  languageCode: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  micButton: {
    backgroundColor: '#EAF4FB',
    borderRadius: 50,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#B5D3EC',
  },
  micButtonActive: {
    backgroundColor: '#FFE0E6',
    borderColor: '#FF3366',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#F4FBFF',
    borderRadius: 16,
    padding: 24,
    width: 300,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 18,
    color: '#22577A',
  },
  languageOption: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#EAF4FB',
    width: '100%',
    alignItems: 'center',
  },
  languageOptionSelected: {
    backgroundColor: '#57A6FF',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#22577A',
  },
  languageOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  translationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  translationIcon: {
    marginRight: 3,
  },
  translationNote: {
    fontSize: 12,
    color: '#7FB5E8',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#22577A',
    marginTop: 10,
    fontWeight: 'bold',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#7FB5E8',
    marginTop: 5,
  },
  typingIndicator: {
    height: 20,
    paddingHorizontal: 15,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
    paddingHorizontal: 10,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1E3F0',
  },
  dateHeaderText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: '#7FB5E8',
    backgroundColor: '#EAF4FB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  reactionEmoji: {
    fontSize: 14,
    marginHorizontal: 2,
  },
  attachButton: {
    backgroundColor: '#EAF4FB',
    borderRadius: 50,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#B5D3EC',
  },
  messageContextMenu: {
    position: 'absolute',
    zIndex: 1000,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  contextMenuItemText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#22577A',
  },
  contextMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 12,
    color: '#7FB5E8',
    fontStyle: 'italic',
  },
  typingDots: {
    flexDirection: 'row',
    marginLeft: 5,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#7FB5E8',
    marginHorizontal: 1,
  },
  scrollToBottom: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    zIndex: 100,
  },
  scrollToBottomButton: {
    backgroundColor: 'white',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  pendingMessage: {
    opacity: 0.7,
  },
  connectionBanner: {
    width: '100%',
    backgroundColor: '#FF3B30',
    padding: 6,
    alignItems: 'center',
  },
  connectionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  offlineIndicator: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 51, 102, 0.7)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  offlineText: {
    color: 'white',
    fontSize: 10,
  },
  searchBarContainer: {
    backgroundColor: '#C7E0F9',
    borderBottomWidth: 1,
    borderBottomColor: '#B5D3EC',
    padding: 8,
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    height: 36,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#22577A',
    fontSize: 14,
    paddingVertical: 6,
  },
  imageContainer: {
    marginBottom: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
  },
  imagePreviewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  selectedMessage: {
    borderWidth: 2,
    borderColor: '#57A6FF',
  },
  selectionIndicator: {
    position: 'absolute',
    left: -30,
    top: '50%',
    marginTop: -10,
  },
  selectionHeader: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  selectionCount: {
    color: '#22577A',
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectionActions: {
    flexDirection: 'row',
  },
  selectionAction: {
    padding: 8,
    marginLeft: 8,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(183, 211, 236, 0.3)',
    borderLeftWidth: 2,
    borderLeftColor: '#57A6FF',
    borderRadius: 4,
    marginBottom: 4,
  },
  replyText: {
    fontSize: 12,
    color: '#7FB5E8',
    marginLeft: 4,
    flex: 1,
  }
});
