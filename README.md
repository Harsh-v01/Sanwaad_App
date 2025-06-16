# Sanwaad - A Real-Time Multilingual Communication Platform 👋

Sanwaad is a real-time communication platform designed to bridge language barriers and foster seamless conversations. Built with [Expo](https://expo.dev) and [Socket.IO](https://socket.io/), Sanwaad enables users to connect instantly, communicate in multiple languages with real-time translation, and enjoy a feature-rich chatting experience across platforms (Android, iOS, and Web).

## Features 🚀

- **Real-Time Messaging**: Instant communication powered by Socket.IO.
- **Multilingual Support**: Translate messages in real-time between multiple languages.
- **Voice-to-Text**: Use speech recognition to send messages hands-free.
- **File-Based Routing**: Organized and scalable routing structure using Expo Router.
- **Light and Dark Mode**: Automatic theme switching based on user preferences.
- **Custom Animations**: Smooth animations using `react-native-reanimated`.
- **Cross-Platform Support**: Works seamlessly on Android, iOS, and Web.
- **User Profiles**: Customize your profile with a name, status, and avatar.
- **Typing Indicators**: See when others are typing in real-time.
- **Message Context Menu**: Copy, forward, or delete messages with ease.
- **Search Messages**: Quickly find messages using the search bar.
- **Language Personalization**: Select your preferred language for a tailored experience.

## Project Structure 📂

The project is organized as follows:

- **`app/`**: Contains the main application code, including screens and components.
  - **`(tabs)/`**: Tab-based navigation for Home and Explore screens.
  - **`components/`**: Reusable UI components like `HelloWave`, `ParallaxScrollView`, etc.
  - **`hooks/`**: Custom hooks for managing themes and other utilities.
  - **`backend/`**: Node.js server for handling real-time communication with Socket.IO.
- **`assets/`**: Static assets like images and fonts.
- **`scripts/`**: Utility scripts, including `reset-project.js` for resetting the project.

## Getting Started 🛠️

Follow these steps to set up and run the project locally:

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)

### Installation

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the backend server:

   ```bash
   cd backend
   npm install
   npm start
   ```

4. Start the Expo development server:

   ```bash
   cd ..
   npx expo start
   ```

5. Open the app on your device:
   - Use the QR code in the terminal to open the app in Expo Go (Android/iOS).
   - Press `w` to open the app in your web browser.

## Usage 📱

1. **Start Chatting**: Enter your name on the home screen and join the chat.
2. **Language Selection**: Choose your preferred language for real-time translation.
3. **Voice Messages**: Use the microphone button to send voice-to-text messages.
4. **Explore Features**: Navigate to the Explore tab to learn more about the app's capabilities.

## Future Scope 🌟

Here are some potential enhancements for Sanwaad:

- **Group Conversations**: Enable users to create and join group chats for collaborative discussions.
- **Media Sharing**: Add support for sharing images, videos, and documents.
- **Push Notifications**: Notify users of new messages even when the app is closed.
- **End-to-End Encryption**: Ensure secure communication with encrypted messages.
- **Offline Mode**: Allow users to view chat history and draft messages offline.
- **Custom Themes**: Let users personalize the app's appearance with custom themes.
- **AI-Powered Features**: Integrate AI for features like smart replies, sentiment analysis, and language detection.
- **Video and Audio Calls**: Expand communication options with real-time video and audio calling.
- **Integration with External APIs**: Enable integration with third-party services like Google Translate for enhanced translations.

## Learn More 📚

To learn more about the technologies used in this project, check out the following resources:

- [Expo Documentation](https://docs.expo.dev/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)

## Contributing 🤝

Contributions are welcome! If you'd like to contribute, please fork the repository and submit a pull request.

## License 📄

This project is licensed under the MIT License. See the LICENSE file for details.

## Contact 📧

For any questions or feedback, feel free to reach out at [contactharsh15113@gmail.com](mailto:contactharsh15113@gmail.com).

---
Happy chatting with Sanwaad! 🎉
