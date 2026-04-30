# Q ME NOW — Mobile App

Built with **Expo + React Native + TypeScript**.

---

## Screens

| Screen | Description |
|---|---|
| `LoginScreen` | Sign in / sign up with Supabase Auth |
| `HomeScreen` | Saved businesses (top) + visit history (bottom) |
| `SearchScreen` | Search all businesses |
| `BusinessScreen` | Branch list for a business |
| `BranchScreen` | Service list for a branch with wait times |
| `JoinQueueScreen` | Confirmation before joining |
| `TicketScreen` | Live ticket with position, wait timer, pulse on call |
| `HistoryScreen` | Full visit history |
| `ProfileScreen` | User profile + sign out |

---

## Setup

```bash
cd apps/mobile
cp app.json app.json   # Fill in extra.supabaseUrl, extra.supabaseAnonKey, extra.apiUrl
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) to preview.

---

## Build

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Configure project
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

---

## Notifications

The app uses `expo-notifications` to send local push notifications when:
- Your estimated wait time changes significantly
- You are near the front of the queue (position ≤ 3)
- You are called to the counter

Notification permission is requested on first queue join.
