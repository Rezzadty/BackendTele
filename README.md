<p align="center">
  <a href="https://x.com/RoroaLora/status/2047873004793991403?s=20">
    <img src="src/presentation/HGuBpHlasAAEOlo.jpg" width="150" />
  </a>
</p>

# Telegram Backend (Express.js)

This project uses Express.js. It is built to check Firebase data updates from the microcontroller and send notifications to Telegram.

For now, this repository has a scratch implementation for notification delivery flow:

1. Send notification to Expo Push API (for React Expo app)
2. Trigger Telegram backup notification based on backup mode
3. Poll Firebase Realtime Database to detect issue/recovery events automatically

## Layer Overview

- domain: business rules and interfaces
- application: use cases and application logic
- infrastructure: Firebase and Telegram implementations
- presentation: Express.js routes and background workers
- main: app bootstrap and dependency wiring

## Scratch Flow

- Endpoint: `POST /api/notifications/send`
- Primary channel: Expo Push Notification
- Backup channel: Telegram Bot

Telegram backup behavior can be controlled with `TELEGRAM_BACKUP_MODE`:

- `on-failure` (default): Telegram only when Expo fails
- `always`: Always send Telegram
- `off`: Never send Telegram

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

If you use Windows PowerShell to create `.env`:

```powershell
Copy-Item .env.example .env
```

### Which values from Expo .env are reused?

- `EXPO_PUBLIC_FIREBASE_DATABASE_URL` can be reused as `FIREBASE_DATABASE_URL` for backend polling.
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID` is useful for future admin SDK integration, but not required for current REST polling worker.
- `EXPO_PUBLIC_FIREBASE_API_KEY` and other `EXPO_PUBLIC_*` client vars are mainly for mobile/web client SDK, not for backend alert logic.

If your Firebase rules are protected, you also need:

- `FIREBASE_AUTH_TOKEN` (database auth token) or another server-side auth approach.

For backend notifications you still need backend-only values:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_DEFAULT_CHAT_ID` (or request-level `telegramChatId`)
- `DEFAULT_EXPO_PUSH_TOKEN` (temporary single-device target for worker alerts)

## Current Files (Scratch)

- `src/shared/config/env.js`: environment config
- `src/infrastructure/expo/expoPushService.js`: Expo push sender
- `src/infrastructure/telegram/telegramService.js`: Telegram sender
- `src/application/usecases/sendNotificationWithBackup.js`: notification logic
- `src/presentation/routes/notificationRoutes.js`: API route
- `src/presentation/workers/firebasePollingWorker.js`: realtime polling worker
- `src/main/createApp.js`: Express app factory
- `src/main/server.js`: dependency wiring and server start
