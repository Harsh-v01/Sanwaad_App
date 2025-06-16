const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

// Store users with proper naming convention
const users = {};

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Handle user joining with name
  socket.on('user_join', (userData) => {
    console.log('User joined with data:', userData);
    
    // Store user with consistent property names
    users[socket.id] = {
      id: socket.id,
      name: userData.name || userData.username || 'Anonymous',
      username: userData.name || userData.username || 'Anonymous',
      preferredLanguage: userData.preferredLanguage || 'en',
      online: true,
      lastSeen: new Date().toISOString()
    };
    
    // Broadcast updated user list to ALL clients
    io.emit('user_list', Object.values(users));
    console.log('Current users:', Object.values(users));
  });

  // Handle message sending - broadcast to ALL clients
  socket.on('send_message', (data) => {
    console.log('Message received from client:', data);
    
    // Make sure user exists
    if (!users[socket.id]) {
      console.log('User not found, creating default user');
      users[socket.id] = {
        id: socket.id,
        name: 'Anonymous',
        username: 'Anonymous',
        online: true,
        preferredLanguage: 'en'
      };
    }
    
    // Create properly formatted message with source language
    const messageData = {
      id: Date.now().toString(),
      senderId: socket.id,
      senderName: users[socket.id]?.name || 'Anonymous',
      originalText: data.message || '',
      message: data.message || '',
      sourceLanguage: data.sourceLanguage || users[socket.id].preferredLanguage || 'en',
      timestamp: data.timestamp || new Date().toISOString()
    };
    
    console.log('Broadcasting message to all clients:', messageData);
    io.emit('receive_message', messageData);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete users[socket.id];
    io.emit('user_list', Object.values(users));
  });
});

http.listen(3000, '0.0.0.0', () => {
  console.log('Server running on http://0.0.0.0:3000');
});
