import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, Animated } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true
    }).start();
  }, []);

  const handleGoToChat = () => setModalVisible(true);
  const handleEnterChat = () => {
    if (name.trim()) {
      setModalVisible(false);
      router.push({ pathname: '/users', params: { name } });
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        <Text style={styles.title}>ChatVibe</Text>
        <Text style={styles.subtitle}>Connect instantly with friends</Text>
        <TouchableOpacity style={styles.chatButton} onPress={handleGoToChat}>
          <Text style={styles.buttonText}>Start Chatting</Text>
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>What's your name?</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#666"
              autoFocus
            />
            <TouchableOpacity style={styles.enterButton} onPress={handleEnterChat}>
              <Text style={styles.enterButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF4FB', // light blue background
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#22577A', // deep blue
    marginBottom: 10,
    textShadowColor: 'rgba(87,166,255,0.1)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#57A6FF',
    marginBottom: 40,
  },
  chatButton: {
    backgroundColor: '#57A6FF',
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#22577A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#F4FBFF',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 300,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#22577A',
  },
  input: {
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomColor: '#57A6FF',
    fontSize: 18,
    paddingVertical: 10,
    marginBottom: 30,
    color: '#22577A',
  },
  enterButton: {
    backgroundColor: '#57A6FF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  enterButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
