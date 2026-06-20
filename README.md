<p align="center">
  <a href="https://x.com/RoroaLora/status/2047873004793991403?s=20">
    <img src="src/presentation/HGuBpHlasAAEOlo.jpg" width="150" />
  </a>
</p>

# Telegram Backend (Express.js)

This project uses Express.js. It checks Firebase Realtime Database updates from the microcontroller and sends notifications through a Telegram bot.

## Project Context

> **This repository is the Telegram backend for the backup notification system of the [Gomi Project](https://github.com/Rezzadty/Gomi).**

The [Gomi Project](https://github.com/Rezzadty/Gomi) is an air quality monitoring application that tracks sensor data (e.g., MQ135, MQ7) and alerts users when air quality reaches a **bad/poor** level. This backend service acts as a **fallback/backup notification channel** — it ensures that users still receive Telegram alerts about dangerous air quality conditions in the event that the main Gomi application fails to deliver notifications (e.g., app is closed, push notification service is unavailable, or the device is offline).

In short:

- **Primary**: Gomi mobile app sends in-app notifications about air quality status.
- **Backup (this repo)**: If the Gomi app does not send a notification, this Telegram backend polls Firebase Realtime Database and automatically sends a Telegram alert to the configured chat when poor/bad air quality is detected.

Current implementation flow:

1. Send Telegram notification manually through API endpoint.
2. Poll Firebase Realtime Database to detect issue/recovery events automatically.
3. Send alert/recovery messages to Telegram from worker process.

## Layer Overview

- domain: business rules and interfaces
- application: use cases and application logic
- infrastructure: Telegram implementation
- presentation: Express.js routes and background workers
- main: app bootstrap and dependency wiring

## Notification API

- Endpoint: `POST /api/notifications/send`
- Channel: Telegram Bot

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

## Environment Variables

Telegram:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_DEFAULT_CHAT_ID` (used when request does not include `telegramChatId`)
- `DEFAULT_TELEGRAM_CHAT_ID` (used by Firebase worker alerts)

Firebase worker:

- `FIREBASE_DATABASE_URL`
- `FIREBASE_AUTH_TOKEN` (optional static Firebase ID token)
- `FIREBASE_API_KEY` (required for automatic email/password sign-in)
- `FIREBASE_AUTH_EMAIL` (required for automatic email/password sign-in)
- `FIREBASE_AUTH_PASSWORD` (required for automatic email/password sign-in)
- `FIREBASE_SENSOR_PATH`
- `ENABLE_FIREBASE_POLLING_WORKER`
- `FIREBASE_POLL_INTERVAL_MS`
- `SENSOR_STATUS_FIELDS` (for example: `mq135_status,mq7_status`)
- `SENSOR_DANGER_STATUS_VALUES` (for example: `dangerous`)
- `SENSOR_CLEAN_STATUS_VALUES` (for example: `clean`)
- `SENSOR_EVENT_TIMESTAMP_FIELD`
- `SENSOR_OFFLINE_AFTER_MS`
- `FIREBASE_OFFLINE_REPEAT_INTERVAL_MS`
- `ALERT_ON_MISSING_DATA`
- `MAX_ISSUE_NOTIFICATIONS`
- `SEND_RESOLVED_NOTIFICATION`

## Current Files (Scratch)

- `src/shared/config/env.js`: environment config
- `src/infrastructure/telegram/telegramService.js`: Telegram sender
- `src/application/usecases/sendNotificationWithBackup.js`: Telegram notification logic
- `src/presentation/routes/notificationRoutes.js`: API route
- `src/presentation/workers/firebasePollingWorker.js`: realtime polling worker
- `src/main/createApp.js`: Express app factory
- `src/main/server.js`: dependency wiring and server start
