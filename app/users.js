import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated, Modal, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import io from 'socket.io-client';

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

export default function UsersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [language, setLanguage] = useState('en');
  const [languageModal, setLanguageModal] = useState(false);
  const socketRef = useRef(null);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    // Show language selection modal if not set
    if (!params.language && !language) {
      setLanguageModal(true);
    }
  }, []);

  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;

    function connectSocket() {
      console.log('Connecting to socket server...');
      socketRef.current = io('http://192.168.31.55:3000', {
        transports: ['websocket'],
        reconnection: true
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        // Always use the name from params for this session
        const userName = params.name || `User_${Math.floor(Math.random() * 1000)}`;
        // Save the actual name in a ref for later use
        socketRef.current.myName = userName;
        console.log(`Connected as ${userName} with ID: ${socket.id}`);
        // Use selected language or default to English
        const lang = params.language || language || 'en';
        socketRef.current.myLanguage = lang;
        socket.emit('user_join', {
          name: userName,
          username: userName,
          preferredLanguage: lang
        });
      });
      
      // Use the correct event name matching the backend
      socket.on('user_list', (users) => {
        console.log(`Received users: ${JSON.stringify(users)}`);
        const myId = socketRef.current?.id;
        
        // Better filtering to ensure user doesn't see themselves
        const others = users.filter(user => {
          return user.id !== myId;
        });
        
        console.log(`Filtered users (excluding self): ${JSON.stringify(others)}`);
        setOnlineUsers(others);
        setAllUsers(users);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setConnectionStatus('disconnected');
      });

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true
      }).start();

      return () => {
        console.log('Cleaning up socket connection');
        socket.disconnect();
      };
    }

    connectSocket();

    return () => {
      if (socketRef.current) {
        console.log('Cleaning up socket connection');
        socketRef.current.disconnect();
      }
    };
  }, [params.name, language]);

  // Language change handler
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setLanguageModal(false);
    // Notify backend if already connected
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('language_change', { language: lang });
      socketRef.current.myLanguage = lang;
    }
  };

  // UI for language selection modal
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

  // Update renderUser function to handle both username and name properties
  const renderUser = ({ item }) => (
    <TouchableOpacity 
      style={styles.userCard}
      onPress={() => router.push({ 
        pathname: '/chat', 
        params: { 
          userId: item.id,
          userName: item.name || item.username || 'User'
        }
      })}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name || item.username || 'User') }]}>
          <Text style={styles.avatarText}>
            {getInitials(item.name || item.username || 'User')}
          </Text>
        </View>
        <View style={styles.onlineIndicator} />
      </View>
      <View style={styles.userInfo}>
        {/* Always show the actual name from the backend */}
        <Text style={styles.userName}>{item.name || item.username || 'User'}</Text>
        <Text style={styles.activeStatus}>Online</Text>
      </View>
    </TouchableOpacity>
  );

  // Add connection status display
  const renderConnectionStatus = () => (
    <View style={styles.statusContainer}>
      <Text style={[styles.statusText, { color: connectionStatus === 'connected' ? '#4CAF50' : '#FF3366' }]}>
        {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderLanguageModal()}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Active Chats</Text>
        {renderConnectionStatus()}
        <TouchableOpacity onPress={() => setLanguageModal(true)}>
          <View style={styles.profileButton}>
            <Text style={styles.profileButtonText}>
              {LANGUAGES.find(l => l.code === (language || 'en'))?.label || 'Language'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {onlineUsers.length > 0 ? (
          <FlatList
            data={onlineUsers}
            renderItem={renderUser}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No users online</Text>
            <Text style={styles.emptyStateSubtext}>Wait for someone to join...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getInitials(name) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name) {
  const colors = [
    '#FF3366', '#FF6B6B', '#4ECDC4', '#45B7D1',
    '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6'
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF4FB', // lighter blue background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#C7E0F9', // light blue header
    borderBottomWidth: 1,
    borderBottomColor: '#B5D3EC',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#22577A', // deep blue text
  },
  profileButton: {
    backgroundColor: '#57A6FF', // blue accent
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  profileButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    marginTop: 10,
    marginBottom: 10,
  },
  userCard: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#F4FBFF', // very light blue card
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B5D3EC',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#57A6FF', // blue for avatar
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#EAF4FB',
    backgroundColor: '#4CAF50',
  },
  userInfo: {
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22577A',
    marginBottom: 4,
  },
  activeStatus: {
    fontSize: 14,
    color: '#4CAF50',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#57A6FF',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#7FB5E8',
  },
  statusContainer: {
    position: 'absolute',
    top: 90,
    left: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22577A',
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
});
