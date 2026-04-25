const DEFAULT_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function parsePort(value, fallback) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseBoolean(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

const env = {
  PORT: parsePort(process.env.PORT, 3000),
  EXPO_PUSH_URL: process.env.EXPO_PUSH_URL || DEFAULT_EXPO_PUSH_URL,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_DEFAULT_CHAT_ID: process.env.TELEGRAM_DEFAULT_CHAT_ID || "",
  TELEGRAM_BACKUP_MODE: process.env.TELEGRAM_BACKUP_MODE || "on-failure",
  FIREBASE_DATABASE_URL:
    process.env.FIREBASE_DATABASE_URL ||
    process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ||
    "",
  FIREBASE_AUTH_TOKEN: process.env.FIREBASE_AUTH_TOKEN || "",
  FIREBASE_SENSOR_PATH: process.env.FIREBASE_SENSOR_PATH || "sensor/latest",
  ENABLE_FIREBASE_POLLING_WORKER: parseBoolean(
    process.env.ENABLE_FIREBASE_POLLING_WORKER,
    true
  ),
  FIREBASE_POLL_INTERVAL_MS: parsePositiveInteger(
    process.env.FIREBASE_POLL_INTERVAL_MS,
    5000
  ),
  SENSOR_STATUS_FIELD: process.env.SENSOR_STATUS_FIELD || "status",
  SENSOR_BAD_STATUS_VALUES:
    process.env.SENSOR_BAD_STATUS_VALUES || "warning,danger,error,critical",
  SENSOR_VALUE_FIELD: process.env.SENSOR_VALUE_FIELD || "",
  SENSOR_VALUE_THRESHOLD: parseOptionalNumber(process.env.SENSOR_VALUE_THRESHOLD),
  SENSOR_EVENT_TIMESTAMP_FIELD:
    process.env.SENSOR_EVENT_TIMESTAMP_FIELD || "updatedAt",
  ALERT_ON_MISSING_DATA: parseBoolean(process.env.ALERT_ON_MISSING_DATA, true),
  NOTIFICATION_COOLDOWN_MS: parsePositiveInteger(
    process.env.NOTIFICATION_COOLDOWN_MS,
    120000
  ),
  SEND_RESOLVED_NOTIFICATION: parseBoolean(
    process.env.SEND_RESOLVED_NOTIFICATION,
    true
  ),
  DEFAULT_EXPO_PUSH_TOKEN: process.env.DEFAULT_EXPO_PUSH_TOKEN || "",
  DEFAULT_TELEGRAM_CHAT_ID:
    process.env.DEFAULT_TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_DEFAULT_CHAT_ID ||
    "",
};

function getRuntimeWarnings() {
  const warnings = [];

  if (!env.TELEGRAM_BOT_TOKEN) {
    warnings.push(
      "TELEGRAM_BOT_TOKEN is empty. Telegram backup notification will be skipped."
    );
  }

  if (!env.TELEGRAM_DEFAULT_CHAT_ID) {
    warnings.push(
      "TELEGRAM_DEFAULT_CHAT_ID is empty. Provide telegramChatId in request body or set this env value."
    );
  }

  if (env.ENABLE_FIREBASE_POLLING_WORKER && !env.FIREBASE_DATABASE_URL) {
    warnings.push(
      "FIREBASE_DATABASE_URL is empty. Realtime polling worker will not start."
    );
  }

  if (env.ENABLE_FIREBASE_POLLING_WORKER && !env.FIREBASE_AUTH_TOKEN) {
    warnings.push(
      "FIREBASE_AUTH_TOKEN is empty. Polling works only when database read rules allow public read."
    );
  }

  if (
    env.ENABLE_FIREBASE_POLLING_WORKER &&
    !env.DEFAULT_EXPO_PUSH_TOKEN &&
    (!env.TELEGRAM_BOT_TOKEN || !env.DEFAULT_TELEGRAM_CHAT_ID)
  ) {
    warnings.push(
      "DEFAULT_EXPO_PUSH_TOKEN is empty and Telegram defaults are incomplete. Worker may detect issues but cannot deliver notifications."
    );
  }

  if (env.SENSOR_VALUE_FIELD && env.SENSOR_VALUE_THRESHOLD === null) {
    warnings.push(
      "SENSOR_VALUE_FIELD is set but SENSOR_VALUE_THRESHOLD is empty/invalid. Numeric threshold rule will be ignored."
    );
  }

  return warnings;
}

module.exports = {
  env,
  getRuntimeWarnings,
};
